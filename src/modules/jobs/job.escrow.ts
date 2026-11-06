import { env } from "../../config/env.ts"
import { badRequest, conflict, notFound } from "../../lib/errors.ts"
import { logger } from "../../lib/logger.ts"
import { sendMail } from "../../lib/mailer.ts"
import * as paystack from "../../lib/paystack.ts"
import { percentOf } from "../../lib/pricing.ts"
import { ProModel } from "../pros/pro.model.ts"
import { commissionFor, getSettings } from "../settings/setting.service.ts"
import { UserModel } from "../users/user.model.ts"
import { JobModel } from "./job.model.ts"

/**
 * Escrow for service jobs: the buyer pays each stage to SheltaMart, the money is held,
 * and the pro is paid (minus commission) once the buyer releases it. Admins settle reported problems.
 */

type JobDoc = NonNullable<Awaited<ReturnType<typeof JobModel.findOne>>>
type StageDoc = JobDoc["stages"][number]

const REFERENCE_PREFIX = "JOB-"
export const isJobReference = (reference: string) => reference.startsWith(REFERENCE_PREFIX)
const callbackUrl = () => `${env.CLIENT_URL}/account/jobs/paid`

function findStage(job: JobDoc, stageId: string) {
  const stage = job.stages.id(stageId)
  if (!stage) throw notFound("Payment stage")
  return stage
}

async function proEmail(proId: unknown) {
  const pro = await ProModel.findById(proId).populate<{ owner: { email: string } }>("owner", "email")
  return pro?.owner.email
}

/** Starts a Paystack checkout for one stage. Stages are paid in order. */
export async function startStagePayment(user: string, jobId: string, stageId: string) {
  const job = await JobModel.findOne({ _id: jobId, user })
  if (!job) throw notFound("Job")
  if (job.status !== "hired") throw conflict("Only a job in progress can be paid")
  const stage = findStage(job, stageId)
  if (stage.status !== "unpaid" && stage.status !== "pending") throw conflict("This stage is already paid")
  if (job.stages.some((s) => s !== stage && (s.status === "unpaid" || s.status === "pending") && job.stages.indexOf(s) < job.stages.indexOf(stage)))
    throw badRequest("Pay the earlier stage first")
  stage.attempts += 1
  stage.set({ status: "pending", reference: `${REFERENCE_PREFIX}${job.id}-${String(stage._id)}-${stage.attempts}` })
  await job.save()
  const buyer = await UserModel.findById(user).orFail()
  return paystack.initializeTransaction({
    email: buyer.email,
    amount: stage.amount,
    reference: stage.reference!,
    channels: ["card", "bank_transfer", "ussd"],
    callbackUrl: callbackUrl(),
    metadata: { job: job.id, stage: String(stage._id) },
  })
}

/** Moves a stage into escrow once Paystack confirms the money. Safe to call more than once. */
export async function markStagePaid(reference: string, amountPaid: number) {
  const job = await JobModel.findOne({ "stages.reference": reference })
  const stage = job?.stages.find((s) => s.reference === reference)
  if (!job || !stage || stage.status !== "pending") return job
  if (amountPaid < stage.amount) {
    logger.error({ reference, amountPaid, amount: stage.amount }, "Underpaid job stage")
    stage.status = "unpaid"
    return job.save()
  }
  stage.set({ status: "held", paidAt: new Date() })
  await job.save()
  const to = await proEmail(job.hired)
  if (to) await sendMail({ to, subject: `Paid into escrow: ${job.title}`, text: `The buyer paid “${stage.title}” (₦${stage.amount.toLocaleString("en-NG")}). It’s held by SheltaMart and released to you when they confirm the work.` })
  return job
}

/** Called from the payment return page. */
export async function verifyStagePayment(user: string, reference: string) {
  const job = await JobModel.findOne({ user, "stages.reference": reference })
  const stage = job?.stages.find((s) => s.reference === reference)
  if (!job || !stage) throw notFound("Payment")
  if (stage.status !== "pending") return job
  const paid = await paystack.verifyTransaction(reference, stage.amount)
  return paid === null ? job : ((await markStagePaid(reference, paid)) ?? job)
}

/** Completes the job once nothing is left to pay or hold (cancelled if every stage was refunded). */
async function settle(job: JobDoc) {
  if (job.stages.some((s) => ["unpaid", "pending", "held"].includes(s.status))) return
  const released = job.stages.some((s) => s.status === "released")
  job.status = released ? "completed" : "cancelled"
  if (released) await ProModel.updateOne({ _id: job.hired }, { $inc: { jobsDone: 1 } })
}

/** Sends the pro their share. Leaves it pending if they haven't added a bank account yet. */
async function payStage(job: JobDoc, stage: StageDoc) {
  const pro = await ProModel.findById(job.hired)
  const recipientCode = pro?.payout?.recipientCode
  if (!recipientCode || !stage.payout) return
  const reference = `${REFERENCE_PREFIX}PAYOUT-${String(stage._id)}`
  try {
    await paystack.transfer({ amount: stage.payout, recipientCode, reference, reason: `SheltaMart job: ${job.title}` })
    stage.set({ payoutStatus: "paid", payoutReference: reference })
  } catch (err) {
    logger.error({ err, reference }, "Job payout failed")
    stage.set({ payoutStatus: "failed", payoutReference: reference })
  }
}

async function release(job: JobDoc, stage: StageDoc) {
  if (stage.status !== "held") throw conflict("Only money held in escrow can be released")
  const settings = await getSettings()
  const commission = percentOf(stage.amount, commissionFor({ commissionRate: settings.serviceCommissionRate, categoryCommission: settings.categoryCommission }, job.trade))
  stage.set({
    status: "released",
    releasedAt: new Date(),
    commission,
    payout: stage.amount - commission,
    payoutStatus: "pending",
    payoutDueAt: new Date(Date.now() + settings.payoutDelayHours * 3_600_000),
    issue: undefined,
  })
  if (!settings.payoutDelayHours) await payStage(job, stage)
  await settle(job)
  await job.save()
  const to = await proEmail(job.hired)
  if (to) await sendMail({ to, subject: `Payment released: ${job.title}`, text: `₦${stage.payout!.toLocaleString("en-NG")} for “${stage.title}” is on its way to your bank account.` })
  return job
}

/** The buyer confirms a stage's work is done. */
export async function releaseStage(user: string, jobId: string, stageId: string) {
  const job = await JobModel.findOne({ _id: jobId, user })
  if (!job) throw notFound("Job")
  return release(job, findStage(job, stageId))
}

/** The buyer flags a problem with paid work; the money stays held until an admin settles it. */
export async function reportStage(user: string, jobId: string, stageId: string, message: string) {
  const job = await JobModel.findOne({ _id: jobId, user })
  if (!job) throw notFound("Job")
  const stage = findStage(job, stageId)
  if (stage.status !== "held") throw conflict("You can report a problem on money held in escrow")
  stage.issue = { message, at: new Date() }
  return job.save()
}

// ——— Admin ———

/** Jobs with money in escrow, a reported problem or a payout that hasn't gone through. */
export const listEscrow = () =>
  JobModel.find({ stages: { $elemMatch: { $or: [{ status: "held" }, { payoutStatus: { $in: ["pending", "failed"] } }] } } })
    .sort({ updatedAt: -1 })
    .limit(200)
    .populate("user", "name email")
    .populate("hired", "slug name phone")

export async function adminRelease(jobId: string, stageId: string) {
  const job = await JobModel.findById(jobId)
  if (!job) throw notFound("Job")
  return release(job, findStage(job, stageId))
}

/** Returns a held stage's money to the buyer. */
export async function adminRefund(jobId: string, stageId: string) {
  const job = await JobModel.findById(jobId)
  if (!job) throw notFound("Job")
  const stage = findStage(job, stageId)
  if (stage.status !== "held") throw conflict("Only money held in escrow can be refunded")
  await paystack.refund(stage.reference!, stage.amount)
  stage.set({ status: "refunded", issue: undefined })
  // Later stages can't be paid for work that's been refunded.
  for (const s of job.stages) if (s.status === "unpaid") s.status = "refunded"
  await settle(job)
  return job.save()
}

/** Pays every released stage whose payout is due. */
export async function processDueJobPayouts() {
  const jobs = await JobModel.find({ stages: { $elemMatch: { payoutStatus: { $in: ["pending", "failed"] }, payoutDueAt: { $lte: new Date() } } } })
  let paid = 0
  for (const job of jobs) {
    for (const stage of job.stages)
      if (["pending", "failed"].includes(stage.payoutStatus) && stage.payoutDueAt && stage.payoutDueAt <= new Date()) {
        await payStage(job, stage)
        if (stage.payoutStatus === "paid") paid++
      }
    await job.save()
  }
  return { paid }
}

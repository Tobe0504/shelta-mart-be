import type { QueryFilter } from "mongoose"
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.ts"
import { hasCoords, haversineKm } from "../../lib/geo.ts"
import { paged, skip } from "../../lib/paginate.ts"
import { assertTrades } from "../catalog/catalog.service.ts"
import { notify } from "../notifications/notification.service.ts"
import { ProModel } from "../pros/pro.model.ts"
import { addReview, requireOwnPro } from "../pros/pro.service.ts"
import { getSettings } from "../settings/setting.service.ts"
import { JobModel, type Job } from "./job.model.ts"
import type { BidInput, CreateJobInput, ListJobsInput, ReviewInput } from "./job.schema.ts"

type JobDoc = NonNullable<Awaited<ReturnType<typeof JobModel.findOne>>>
type ProDoc = NonNullable<Awaited<ReturnType<typeof ProModel.findOne>>>
type Json = Record<string, unknown>

/** What a buyer sees of each quoting pro; the phone is removed unless that pro was hired. */
const PRO_CARD = "slug name headline photo rating reviewCount jobsDone verified phone"
const LEAD_POOL = 300

const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)

export async function createJob(user: string, { pro: proSlug, ...input }: CreateJobInput) {
  await assertTrades([input.trade])
  let pro: ProDoc | null = null
  if (proSlug) {
    pro = await ProModel.findOne({ slug: proSlug, active: true })
    if (!pro) throw notFound("Pro")
    if (sameId(pro.owner, user)) throw badRequest("You can’t hire yourself")
  }
  const job = await JobModel.create({ ...input, user, pro: pro?._id })
  await announceJob(job, pro, user)
  return job
}

/** Tells the asked pro, or every active pro in the trade whose radius covers the site, about a new job. */
async function announceJob(job: JobDoc, direct: ProDoc | null, buyer: string) {
  const pros = direct ? [direct] : await ProModel.find({ active: true, trades: job.trade, owner: { $ne: buyer } }).select("owner coords radiusKm").limit(500)
  const reach = pros.filter((p) => direct || !hasCoords(p.coords) || !hasCoords(job.site?.coords) || haversineKm(p.coords, job.site.coords) <= p.radiusKm)
  await notify(
    reach.map((p) => p.owner),
    {
      kind: "job",
      title: direct ? `A buyer asked you for a quote: ${job.title}` : `New job near you: ${job.title}`,
      body: [job.site?.area, job.budget && `budget up to ₦${job.budget.toLocaleString("en-NG")}`, job.startBy && `start ${job.startBy}`].filter(Boolean).join(" · "),
      href: `/pro/jobs/${job.id}`,
    },
  )
}

/** Strips other pros' phones from a buyer's job. */
function buyerView(job: JobDoc) {
  const json = job.toJSON() as unknown as Json & { bids: (Json & { status: string; pro?: Json })[] }
  for (const bid of json.bids) if (bid.status !== "accepted" && bid.pro) delete bid.pro.phone
  return json
}

export async function listMine(user: string, { status, ...page }: ListJobsInput) {
  const filter: QueryFilter<Job> = { user, ...(status && { status }) }
  const [items, total] = await Promise.all([
    JobModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit).populate("bids.pro", PRO_CARD).populate("pro", "slug name"),
    JobModel.countDocuments(filter),
  ])
  return paged(items.map(buyerView), total, page)
}

async function ownJob(user: string, id: string) {
  const job = await JobModel.findOne({ _id: id, user })
  if (!job) throw notFound("Job")
  return job
}

export async function hire(user: string, id: string, bidId: string) {
  const job = await ownJob(user, id)
  if (job.status !== "open") throw conflict("This job isn’t taking quotes any more")
  const bid = job.bids.id(bidId)
  if (!bid) throw notFound("Quote")
  for (const b of job.bids) b.status = b === bid ? "accepted" : "declined"
  const stages = bid.stages.length ? bid.stages : [{ title: "Full job", amount: bid.amount }]
  job.set({ status: "hired", hired: bid.pro, stages: stages.map(({ title, amount }) => ({ title, amount })) })
  await job.save()
  const pro = await ProModel.findById(bid.pro).select("owner")
  await notify(pro?.owner, { kind: "hired", title: `You’ve been hired: ${job.title}`, body: `Call ${job.contactName} on ${job.contactPhone}. You’ll be told when each stage is paid into escrow.`, href: `/pro/jobs/${job.id}` })
  return job
}

/** Cancelling is blocked while money is in escrow or after any has been paid out. */
export async function cancel(user: string, id: string) {
  const job = await ownJob(user, id)
  if (job.status === "completed" || job.status === "cancelled") throw conflict("This job is already closed")
  if (job.stages.some((s) => s.status === "held" || s.status === "pending")) throw conflict("Money for this job is in escrow. Release it, or report a problem so we can refund you.")
  if (job.stages.some((s) => s.status === "released")) throw conflict("Part of this job has been paid out. Contact support to close it.")
  job.status = "cancelled"
  return job.save()
}

export async function review(user: string, id: string, input: ReviewInput) {
  const job = await ownJob(user, id)
  if (job.status !== "completed") throw conflict("You can review once the job is done")
  if (job.reviewed || !job.hired) throw conflict("You’ve already reviewed this job")
  await addReview({ ...input, pro: job.hired, job: job._id, user, name: job.contactName.split(" ")[0] ?? "Buyer" })
  job.reviewed = true
  return job.save()
}

/** Open jobs a pro may quote on: asked of them directly, or in their trades within their radius. */
export async function listLeads(owner: string) {
  const [pro, { jobQuoteLimit }] = await Promise.all([requireOwnPro(owner), getSettings()])
  const jobs = await JobModel.find({
    status: "open",
    user: { $ne: owner },
    "bids.pro": { $ne: pro._id },
    $or: [{ pro: pro._id }, { pro: { $exists: false }, trade: { $in: pro.trades } }],
    $expr: { $lt: [{ $size: "$bids" }, jobQuoteLimit] },
  })
    .sort({ createdAt: -1 })
    .limit(LEAD_POOL)
  return jobs.map((job) => leadFor(job, pro)).filter(reachable)
}

/** A job as a lead for this pro: asked directly, and how far away. */
function leadFor(job: JobDoc, pro: ProDoc) {
  const direct = sameId(job.pro, pro._id)
  const distanceKm = hasCoords(pro.coords) && hasCoords(job.site?.coords) ? Math.round(haversineKm(pro.coords, job.site.coords) * 10) / 10 : null
  return { ...leadView(job), direct, distanceKm, radiusKm: pro.radiusKm }
}
const reachable = ({ direct, distanceKm, radiusKm }: { direct: boolean; distanceKm: number | null; radiusKm: number }) => direct || distanceKm === null || distanceKm <= radiusKm

/** A job as a pro sees it before being hired: no contact or street address. */
function leadView(job: JobDoc) {
  const { id, trade, title, description, photos, budget, startBy, status, createdAt } = job.toJSON() as unknown as Json
  return { id, trade, title, description, photos, budget, startBy, status, createdAt, area: job.site?.area, quotes: job.bids.length }
}

/** Jobs the pro has quoted on, with their quote; contact details only on jobs they won. */
export async function listProJobs(owner: string) {
  const pro = await requireOwnPro(owner)
  const jobs = await JobModel.find({ "bids.pro": pro._id }).sort({ updatedAt: -1 }).limit(100)
  return jobs.map((job) => quotedView(job, pro))
}

/** A job the pro quoted on: their quote, and stages and contact details if they won it. */
function quotedView(job: JobDoc, pro: ProDoc) {
  const won = sameId(job.hired, pro._id)
  const bid = job.bids.find((b) => sameId(b.pro, pro._id))
  const stages = won ? job.stages.map(({ _id, title, amount, status, paidAt, payout, payoutStatus }) => ({ id: String(_id), title, amount, status, paidAt, payout, payoutStatus })) : []
  return { ...leadView(job), bid: bid?.toJSON(), won, stages, ...(won && { contactName: job.contactName, contactPhone: job.contactPhone, address: job.site?.address }) }
}

/** One job for the pro's detail page: their quoted view, or the lead if they may still quote on it. */
export async function getForPro(owner: string, id: string) {
  const [pro, { jobQuoteLimit }] = await Promise.all([requireOwnPro(owner), getSettings()])
  const job = await JobModel.findById(id)
  if (!job) throw notFound("Job")
  if (job.bids.some((b) => sameId(b.pro, pro._id))) return { quoted: true as const, ...quotedView(job, pro) }
  const lead = leadFor(job, pro)
  const open = job.status === "open" && job.bids.length < jobQuoteLimit && !sameId(job.user, owner)
  const mine = job.pro ? lead.direct : pro.trades.includes(job.trade)
  if (!open || !mine || !reachable(lead)) throw notFound("Job")
  return { quoted: false as const, ...lead }
}

/** One of the buyer's jobs, with every quote. */
export async function getMine(user: string, id: string) {
  const job = await JobModel.findOne({ _id: id, user }).populate("bids.pro", PRO_CARD).populate("pro", "slug name")
  if (!job) throw notFound("Job")
  return buyerView(job)
}

export async function placeBid(owner: string, id: string, input: BidInput) {
  const [pro, { jobQuoteLimit }] = await Promise.all([requireOwnPro(owner), getSettings()])
  if (!pro.active) throw forbidden("Your pro profile is paused")
  const job = await JobModel.findById(id).populate<{ user: { _id: unknown; email: string } }>("user", "email")
  if (!job || job.status !== "open") throw notFound("Open job")
  if (sameId(job.user._id, owner)) throw badRequest("You can’t quote on your own job")
  if (job.pro ? !sameId(job.pro, pro._id) : !pro.trades.includes(job.trade)) throw forbidden("This job isn’t in your trades")
  if (job.bids.some((b) => sameId(b.pro, pro._id))) throw conflict("You’ve already sent a quote for this job")
  if (job.bids.length >= jobQuoteLimit) throw conflict("This job has enough quotes")
  job.bids.push({ ...input, pro: pro._id })
  await job.save()
  await notify(job.user._id, { kind: "quote", title: `New quote for “${job.title}”`, body: `${pro.name} quoted ₦${input.amount.toLocaleString("en-NG")} (${input.timeline}).`, href: `/account/jobs/${job.id}` })
  return job.bids.at(-1)
}

export async function listAll({ status, ...page }: ListJobsInput) {
  const filter: QueryFilter<Job> = status ? { status } : {}
  const [items, total] = await Promise.all([
    JobModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit).populate("user", "name email").populate("hired", "slug name"),
    JobModel.countDocuments(filter),
  ])
  return paged(items, total, page)
}

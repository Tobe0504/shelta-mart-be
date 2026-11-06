import { logger } from "../../lib/logger.ts"
import { verifyWebhookSignature } from "../../lib/paystack.ts"
import { isJobReference, markStagePaid } from "../jobs/job.escrow.ts"
import { markPaid, verifyPayment } from "../orders/order.service.ts"

type PaystackEvent = { event: string; data: { reference: string; amount: number; status: string } }

/** Handles a Paystack webhook. Returns false when the signature doesn't match. */
export async function handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) return false
  const event = JSON.parse(rawBody.toString("utf8")) as PaystackEvent
  if (event.event === "charge.success") {
    const { reference, amount } = event.data
    await (isJobReference(reference) ? markStagePaid(reference, amount / 100) : markPaid(reference, amount / 100))
  }
  else logger.info({ event: event.event }, "Ignored Paystack event")
  return true
}

export const verify = verifyPayment

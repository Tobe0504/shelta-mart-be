import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { env } from "../config/env.ts"
import { AppError, badRequest } from "./errors.ts"
import { logger } from "./logger.ts"

/**
 * Thin Paystack client. Amounts are in naira here and converted to kobo on the wire.
 * Without PAYSTACK_SECRET_KEY it runs as a simulator so the full flow works in development.
 */
export const paystackEnabled = Boolean(env.PAYSTACK_SECRET_KEY)
const BASE = "https://api.paystack.co"

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(BASE + path, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T }
  if (!res.ok || !json.status) {
    logger.warn({ path, status: res.status, message: json.message }, "Paystack request failed")
    throw new AppError(res.status === 400 || res.status === 422 ? 400 : 502, "payment_provider", json.message ?? "Payment provider error")
  }
  return json.data as T
}

export type Channel = "card" | "bank_transfer" | "ussd"

export async function initializeTransaction(input: { email: string; amount: number; reference: string; channels: Channel[]; callbackUrl: string; metadata?: object }) {
  if (!paystackEnabled) return { authorizationUrl: `${input.callbackUrl}?reference=${input.reference}&simulated=1`, reference: input.reference }
  const data = await call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: { email: input.email, amount: input.amount * 100, reference: input.reference, channels: input.channels, callback_url: input.callbackUrl, metadata: input.metadata },
  })
  return { authorizationUrl: data.authorization_url, reference: data.reference }
}

/** Returns the amount paid in naira, or null if the payment didn't succeed. */
export async function verifyTransaction(reference: string, expectedAmount: number): Promise<number | null> {
  if (!paystackEnabled) return expectedAmount
  const data = await call<{ status: string; amount: number }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  return data.status === "success" ? data.amount / 100 : null
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!paystackEnabled || !signature) return false
  const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY!).update(rawBody).digest("hex")
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function listBanks() {
  if (!paystackEnabled) return [{ name: "Test Bank", code: "001" }]
  const banks = await call<{ name: string; code: string; active: boolean }[]>("/bank?country=nigeria&perPage=100")
  return banks.filter((b) => b.active).map(({ name, code }) => ({ name, code }))
}

export async function resolveAccount(accountNumber: string, bankCode: string) {
  if (!paystackEnabled) return { accountName: "TEST ACCOUNT" }
  const data = await call<{ account_name: string }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`).catch(() => {
    throw badRequest("We couldn’t verify that account number")
  })
  return { accountName: data.account_name }
}

export async function createRecipient(input: { name: string; accountNumber: string; bankCode: string }) {
  if (!paystackEnabled) return { recipientCode: `RCP_sim_${randomUUID().slice(0, 8)}` }
  const data = await call<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: { type: "nuban", currency: "NGN", name: input.name, account_number: input.accountNumber, bank_code: input.bankCode },
  })
  return { recipientCode: data.recipient_code }
}

export async function transfer(input: { amount: number; recipientCode: string; reference: string; reason: string }) {
  if (!paystackEnabled) return { transferCode: `TRF_sim_${input.reference}` }
  const data = await call<{ transfer_code: string }>("/transfer", {
    method: "POST",
    body: { source: "balance", amount: input.amount * 100, recipient: input.recipientCode, reference: input.reference, reason: input.reason },
  })
  return { transferCode: data.transfer_code }
}

/** Refunds part or all of a transaction. */
export async function refund(reference: string, amount: number) {
  if (!paystackEnabled) return { status: "processed" }
  const data = await call<{ status: string }>("/refund", { method: "POST", body: { transaction: reference, amount: amount * 100 } })
  return { status: data.status }
}

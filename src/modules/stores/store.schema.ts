import { z } from "zod"
import { coordsSchema } from "../../lib/geo.ts"
import { text } from "../../lib/validation.ts"

export const updateStoreSchema = z
  .object({ name: text(120), about: z.string().trim().max(1000), replyTime: text(40), address: text(240), location: text(120), coords: coordsSchema })
  .partial()

export const payoutSchema = z.object({
  bankCode: z.string().trim().min(3).max(10),
  bankName: text(120),
  accountNumber: z.string().regex(/^\d{10}$/, "Enter your 10-digit account number"),
})

export const resolveAccountSchema = payoutSchema.pick({ bankCode: true, accountNumber: true })

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>
export type PayoutInput = z.infer<typeof payoutSchema>

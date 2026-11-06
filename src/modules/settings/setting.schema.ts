import { z } from "zod"
import { naira, slug } from "../../lib/validation.ts"

const rate = z.number().min(0).max(1)

export const updateSettingsSchema = z
  .object({
    commissionRate: rate,
    categoryCommission: z.array(z.object({ category: slug, rate })),
    offloadFee: naira,
    serviceFee: naira,
    deliveryBaseFee: naira,
    deliveryPerKm: naira,
    deliveryMinFee: naira,
    roadFactor: z.number().min(1).max(3),
    maxDeliveryKm: z.number().min(1).max(1000),
    deliveryWindows: z.array(z.string().trim().min(1)).min(1),
    deliveryDaysAhead: z.number().int().min(1).max(14),
    payoutDelayHours: z.number().min(0),
    serviceCommissionRate: rate,
    jobQuoteLimit: z.number().int().min(1).max(20),
  })
  .partial()

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

import { z } from "zod"
import { naira, slug, text } from "../../lib/validation.ts"

export const areaSchema = z.object({ slug, name: text(80), city: text(80), deliveryFee: naira, active: z.boolean().optional() })
export type AreaInput = z.infer<typeof areaSchema>

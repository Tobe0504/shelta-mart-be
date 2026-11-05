import { z } from "zod"
import { naira, pagination, text } from "../../lib/validation.ts"
import { tones } from "../catalog/catalog.model.ts"
import { estateKinds } from "./estate.model.ts"

export const listEstatesSchema = pagination.extend({ kind: z.enum(estateKinds).optional(), city: z.string().trim().max(60).optional() })

export const estateSchema = z.object({
  kind: z.enum(estateKinds),
  name: text(120),
  area: text(80),
  city: text(60),
  detail: z.string().trim().max(200).optional(),
  price: naira,
  per: z.string().trim().max(30).optional(),
  tone: z.enum(tones).optional(),
  images: z.array(z.url()).max(12).optional(),
  developer: z.string().trim().max(120).optional(),
  active: z.boolean().optional(),
})
export const updateEstateSchema = estateSchema.partial()

export type ListEstatesInput = z.infer<typeof listEstatesSchema>
export type EstateInput = z.infer<typeof estateSchema>
export type UpdateEstateInput = z.infer<typeof updateEstateSchema>

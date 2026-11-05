import { z } from "zod"
import { coordsSchema } from "../../lib/geo.ts"
import { phone, text } from "../../lib/validation.ts"

export const siteSchema = z.object({
  label: text(80),
  address: text(240),
  area: text(120),
  coords: coordsSchema,
  contactName: text(80),
  contactPhone: phone,
  notes: z.string().trim().max(500).optional(),
})

export const updateSiteSchema = siteSchema.partial()
export type SiteInput = z.infer<typeof siteSchema>
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>

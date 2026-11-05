import { z } from "zod"
import { slug, text } from "../../lib/validation.ts"
import { promoIcons, promoThemes } from "./promo.model.ts"

export const listPromosSchema = z.object({ category: slug.optional() })

export const promoSchema = z.object({
  badge: text(30),
  title: text(80),
  text: text(140),
  cta: text(30),
  /** In-app path such as /search?category=cement. */
  href: z.string().trim().regex(/^\/[^\s]*$/, "Use a path that starts with /"),
  theme: z.enum(promoThemes).optional(),
  icon: z.enum(promoIcons).optional(),
  category: slug.optional(),
  sponsor: z.string().trim().max(60).optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
})
export const updatePromoSchema = promoSchema.partial()

export type PromoInput = z.infer<typeof promoSchema>
export type UpdatePromoInput = z.infer<typeof updatePromoSchema>

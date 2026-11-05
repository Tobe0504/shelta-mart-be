import { z } from "zod"
import { list, naira, pagination, slug, text } from "../../lib/validation.ts"
import { productStatuses } from "./product.model.ts"

export const searchSchema = pagination.extend({
  q: z.string().trim().max(100).optional(),
  category: slug.optional(),
  brand: list(z.string().trim().min(1)),
  deals: z.stringbool().optional(),
  sort: z.enum(["best", "price-asc", "price-desc", "newest"]).default("best"),
})

const tier = z.object({ label: text(40), min: z.number().int().min(1), price: naira })

// No `.default()`s here: the Mongoose model owns defaults, so `.partial()` PATCH bodies never overwrite fields.
export const productSchema = z.object({
  name: text(160),
  brand: text(80),
  category: slug,
  price: naira.min(1),
  was: naira.optional(),
  unit: text(30),
  tiers: z.array(tier).max(6).optional(),
  stock: z.number().int().nonnegative(),
  deliveryDays: z.number().int().min(0).max(30).optional(),
  specs: z.array(z.object({ label: text(60), value: text(120) })).max(20).optional(),
  images: z.array(z.url()).max(8).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(productStatuses).optional(),
})

export const updateProductSchema = productSchema.partial()
export const sellerListSchema = pagination.extend({ status: z.enum(productStatuses).optional(), q: z.string().trim().max(100).optional() })

export type SearchInput = z.infer<typeof searchSchema>
export type ProductInput = z.infer<typeof productSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type SellerListInput = z.infer<typeof sellerListSchema>

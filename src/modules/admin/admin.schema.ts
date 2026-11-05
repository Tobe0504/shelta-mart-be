import { z } from "zod"
import { pagination } from "../../lib/validation.ts"

export const listStoresSchema = pagination.extend({
  q: z.string().trim().max(100).optional(),
  verified: z.stringbool().optional(),
})

export type ListStoresInput = z.infer<typeof listStoresSchema>

import { z } from "zod"

export const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
})
export const reverseSchema = z.object({ lat: z.coerce.number(), lng: z.coerce.number() })

export type SearchInput = z.infer<typeof searchSchema>

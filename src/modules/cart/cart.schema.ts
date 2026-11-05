import { z } from "zod"
import { slug } from "../../lib/validation.ts"

const qty = z.number().int().min(0).max(100_000)

export const setLineSchema = z.object({ qty })
export const mergeSchema = z.object({ lines: z.array(z.object({ slug, qty: qty.min(1) })).max(100) })
export const cartQuerySchema = z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() })

export type MergeInput = z.infer<typeof mergeSchema>

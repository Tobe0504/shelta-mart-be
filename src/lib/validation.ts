import { isValidObjectId } from "mongoose"
import { z } from "zod"

/** Reusable Zod building blocks for request input. */
export const objectId = z.string().refine(isValidObjectId, "Invalid id")
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
export const naira = z.number().int().nonnegative()
export const phone = z.string().trim().regex(/^\+?[0-9 ]{10,16}$/, "Enter a valid phone number")
export const text = (max = 200) => z.string().trim().min(1).max(max)

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})
export type Pagination = z.infer<typeof pagination>

/** Query values arrive as string | string[]; normalise to an array. */
export const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (v === undefined ? [] : [v].flat()), z.array(item))

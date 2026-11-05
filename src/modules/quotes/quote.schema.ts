import { z } from "zod"
import { pagination, phone, text } from "../../lib/validation.ts"
import { quoteStatuses } from "./quote.model.ts"

export const createQuoteSchema = z
  .object({
    name: text(80),
    phone,
    email: z.email().optional(),
    site: text(200),
    neededBy: z.string().trim().max(60).optional(),
    items: z.string().trim().max(5000).optional(),
    files: z.array(z.url()).max(5).default([]),
  })
  .refine((q) => q.items || q.files.length, { path: ["items"], message: "Upload a bill of quantities or list what you need" })

export const listQuotesSchema = pagination.extend({ status: z.enum(quoteStatuses).optional() })
export const updateQuoteSchema = z.object({ status: z.enum(quoteStatuses), notes: z.string().trim().max(2000) }).partial()

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type ListQuotesInput = z.infer<typeof listQuotesSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>

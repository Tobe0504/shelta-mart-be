import { z } from "zod"
import { coordsSchema } from "../../lib/geo.ts"
import { naira, pagination, phone, slug, text } from "../../lib/validation.ts"
import { jobStatuses } from "./job.model.ts"

export const createJobSchema = z.object({
  trade: slug,
  title: text(120),
  description: text(3000),
  site: z.object({ address: text(200), area: z.string().trim().max(120).optional(), coords: coordsSchema.optional() }),
  photos: z.array(z.url()).max(8).optional(),
  budget: naira.optional(),
  startBy: z.string().trim().max(80).optional(),
  contactName: text(80),
  contactPhone: phone,
  /** Pro slug, to ask one pro directly instead of every pro nearby. */
  pro: slug.optional(),
})

export const bidSchema = z
  .object({
    amount: naira.min(1),
    timeline: text(80),
    message: z.string().trim().max(1000).optional(),
    /** Up to 4 payment stages; leave out to be paid in one go. */
    stages: z.array(z.object({ title: text(60), amount: naira.min(1) })).max(4).optional(),
  })
  .refine((b) => !b.stages?.length || b.stages.reduce((n, s) => n + s.amount, 0) === b.amount, { message: "Stages must add up to your price", path: ["stages"] })
export const reportSchema = z.object({ message: text(1000) })
export const hireSchema = z.object({ bid: z.string().min(1) })
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).optional() })
export const listJobsSchema = pagination.extend({ status: z.enum(jobStatuses).optional() })

export type CreateJobInput = z.infer<typeof createJobSchema>
export type BidInput = z.infer<typeof bidSchema>
export type ReportInput = z.infer<typeof reportSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type ListJobsInput = z.infer<typeof listJobsSchema>

import { z } from "zod"
import { pagination, phone, slug, text } from "../../lib/validation.ts"
import { enquiryStatuses, enquiryTopics } from "./enquiry.model.ts"

export const createEnquirySchema = z.object({
  topic: z.enum(enquiryTopics),
  /** Product or estate slug, depending on `topic`. */
  target: slug,
  name: text(80),
  phone,
  reason: z.string().trim().max(80).optional(),
  message: text(2000),
})

export const listEnquiriesSchema = pagination.extend({ status: z.enum(enquiryStatuses).optional(), topic: z.enum(enquiryTopics).optional() })
export const updateEnquirySchema = z.object({ status: z.enum(enquiryStatuses) })

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>
export type ListEnquiriesInput = z.infer<typeof listEnquiriesSchema>

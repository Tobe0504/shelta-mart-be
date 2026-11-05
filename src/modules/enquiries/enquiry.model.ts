import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const enquiryTopics = ["product", "estate"] as const
export const enquiryStatuses = ["new", "replied", "closed"] as const

/** A question to a seller about a product, or to the real estate team about a property. */
const enquirySchema = new Schema(
  {
    topic: { type: String, enum: enquiryTopics, required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    estate: { type: Schema.Types.ObjectId, ref: "Estate" },
    /** The store that should answer; empty for estate enquiries (handled by admins). */
    store: { type: Schema.Types.ObjectId, ref: "Store", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: enquiryStatuses, default: "new", index: true },
  },
  schemaOptions(),
)

export type Enquiry = InferSchemaType<typeof enquirySchema>
export const EnquiryModel = model("Enquiry", enquirySchema)

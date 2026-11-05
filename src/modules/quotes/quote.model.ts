import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const quoteStatuses = ["new", "in_progress", "quoted", "closed"] as const

/** A request for quotes on a list of materials, answered by the SheltaMart team. */
const quoteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    site: { type: String, required: true, trim: true },
    neededBy: { type: String, trim: true },
    items: { type: String, trim: true },
    files: [String],
    status: { type: String, enum: quoteStatuses, default: "new", index: true },
    notes: { type: String, trim: true },
  },
  schemaOptions(),
)

export type Quote = InferSchemaType<typeof quoteSchema>
export const QuoteModel = model("Quote", quoteSchema)

import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"

export const jobStatuses = ["open", "hired", "completed", "cancelled"] as const
export const bidStatuses = ["sent", "accepted", "declined"] as const
/** unpaid → pending (checkout started) → held (in escrow) → released to the pro, or refunded to the buyer. */
export const stageStatuses = ["unpaid", "pending", "held", "released", "refunded"] as const
export const payoutStatuses = ["not_due", "pending", "paid", "failed"] as const

/** A pro's quote for a job. */
const bidSchema = new Schema(
  {
    pro: { type: Schema.Types.ObjectId, ref: "Pro", required: true },
    amount: { type: Number, required: true, min: 0 },
    /** How long the work takes, e.g. "3 days". */
    timeline: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    /** Optional payment stages proposed by the pro; they add up to `amount`. */
    stages: [{ _id: false, title: { type: String, required: true, trim: true }, amount: { type: Number, required: true, min: 1 } }],
    status: { type: String, enum: bidStatuses, default: "sent" },
  },
  schemaOptions(),
)

/** A part of the hired quote that the buyer pays into escrow and releases when that work is done. */
const stageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: stageStatuses, default: "unpaid" },
    reference: String,
    attempts: { type: Number, default: 0 },
    paidAt: Date,
    releasedAt: Date,
    /** Kept by SheltaMart, fixed when released. */
    commission: Number,
    payout: Number,
    payoutStatus: { type: String, enum: payoutStatuses, default: "not_due" },
    payoutDueAt: Date,
    payoutReference: String,
    /** A problem the buyer reported; admins then refund or release. */
    issue: { _id: false, message: String, at: Date },
  },
  schemaOptions(),
)

/**
 * Work a buyer wants done. Open jobs show to pros in that trade whose radius covers the site
 * (or only to `pro`, when the buyer asked one pro directly). Contacts are swapped once the buyer hires.
 */
const jobSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trade: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    site: {
      _id: false,
      address: { type: String, required: true, trim: true },
      /** Area and city; all a pro sees before they're hired. */
      area: { type: String, trim: true },
      coords: coordsField,
    },
    photos: [String],
    /** Most the buyer expects to spend, if they said. */
    budget: { type: Number, min: 0 },
    /** When it should start, in the buyer's words, e.g. "next week". */
    startBy: { type: String, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    pro: { type: Schema.Types.ObjectId, ref: "Pro", index: true },
    status: { type: String, enum: jobStatuses, default: "open", index: true },
    hired: { type: Schema.Types.ObjectId, ref: "Pro", index: true },
    bids: [bidSchema],
    /** Set when the buyer hires: the accepted quote split into payable stages. */
    stages: [stageSchema],
    reviewed: { type: Boolean, default: false },
  },
  schemaOptions(),
)
jobSchema.index({ "bids.pro": 1 })
jobSchema.index({ "stages.reference": 1 })

export type Job = InferSchemaType<typeof jobSchema>
export const JobModel = model("Job", jobSchema)

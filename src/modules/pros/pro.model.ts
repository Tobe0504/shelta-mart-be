import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"

export const proKinds = ["individual", "company"] as const
export const rateUnits = ["job", "day", "hour", "m²"] as const

/** A tradesperson or firm buyers can hire. One per user account, separate from any store they run. */
const proSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: proKinds, default: "individual" },
    /** One line under the name, e.g. "Floor and wall tiling, 8 years". */
    headline: { type: String, required: true, trim: true },
    /** Service category slugs. */
    trades: { type: [String], index: true },
    about: { type: String, trim: true },
    /** Short display of their base, e.g. "Surulere, Lagos". */
    location: { type: String, required: true, trim: true },
    coords: coordsField,
    /** How far from `coords` they take jobs, in kilometres. */
    radiusKm: { type: Number, default: 30, min: 1, max: 500 },
    /** Optional starting price shown on their profile. */
    rate: { type: new Schema({ amount: { type: Number, min: 0, required: true }, unit: { type: String, enum: rateUnits, required: true } }, { _id: false }), default: undefined },
    years: { type: Number, min: 0 },
    photo: String,
    portfolio: [String],
    /** Shared with a buyer only once they hire this pro. */
    phone: { type: String, required: true, trim: true },
    /** Where released escrow payments are sent. */
    payout: { _id: false, bankCode: String, bankName: String, accountNumber: String, accountName: String, recipientCode: String },
    verified: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    jobsDone: { type: Number, default: 0 },
  },
  schemaOptions(),
)

/** A buyer's review of a pro, one per completed job. */
const reviewSchema = new Schema(
  {
    pro: { type: Schema.Types.ObjectId, ref: "Pro", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "Job", required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Reviewer's first name, as shown on the profile. */
    name: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true },
  },
  schemaOptions(),
)

export type Pro = InferSchemaType<typeof proSchema>
export type Review = InferSchemaType<typeof reviewSchema>
export const ProModel = model("Pro", proSchema)
export const ReviewModel = model("Review", reviewSchema)

/** Fields safe to show anyone (no owner or phone). */
export const PUBLIC_PRO = "slug name kind headline trades about location coords radiusKm rate years photo portfolio verified rating reviewCount jobsDone createdAt"

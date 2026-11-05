import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"

/** A seller's storefront. One per seller account. */
const storeSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    /** Legacy delivery-area slug, from before distance pricing. */
    area: { type: String, index: true },
    /** Short display of where the warehouse is, e.g. "Oregun, Ikeja". */
    location: String,
    /** Warehouse street address and point; deliveries are priced from here. */
    address: { type: String, trim: true },
    coords: coordsField,
    about: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    replyTime: { type: String, default: "same day" },
    rating: { type: Number, default: 0 },
    payout: {
      bankCode: String,
      bankName: String,
      accountNumber: String,
      accountName: String,
      recipientCode: String,
    },
  },
  schemaOptions(),
)

export type Store = InferSchemaType<typeof storeSchema>
export const StoreModel = model("Store", storeSchema)

/** Fields safe to show buyers. */
export const PUBLIC_STORE = "slug name area location coords about verified replyTime rating"

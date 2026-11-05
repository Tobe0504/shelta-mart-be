import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"

/** A buyer's saved delivery site (a building project or address). */
const siteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    /** Area and city for display, e.g. "Oregun, Ikeja". */
    area: { type: String, trim: true },
    /** Deliveries are priced to this point. */
    coords: coordsField,
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
  },
  schemaOptions(),
)

export type Site = InferSchemaType<typeof siteSchema>
export const SiteModel = model("Site", siteSchema)

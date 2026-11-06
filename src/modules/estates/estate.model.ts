import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"
import { tones } from "../catalog/catalog.model.ts"

export const estateKinds = ["Land", "Apartment", "House", "Short-let"] as const

/** A real estate listing. Kept apart from the materials catalogue. */
const estateSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    kind: { type: String, enum: estateKinds, required: true, index: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    detail: { type: String, trim: true },
    /** Street address or landmark, and the map pin for it. */
    address: { type: String, trim: true },
    coords: coordsField,
    /** Full write-up shown on the property page. */
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    /** Price unit, e.g. "per plot", "per night". */
    per: String,
    tone: { type: String, enum: tones, default: "lilac" },
    images: [String],
    developer: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  schemaOptions(),
)

export type Estate = InferSchemaType<typeof estateSchema>
export const EstateModel = model("Estate", estateSchema)

import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

/** A delivery area with the flat fee charged per shipment delivered there. */
const areaSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    deliveryFee: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  schemaOptions(),
)

export type Area = InferSchemaType<typeof areaSchema>
export const AreaModel = model("Area", areaSchema)

import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

const cartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lines: [{ _id: false, product: { type: Schema.Types.ObjectId, ref: "Product", required: true }, qty: { type: Number, required: true, min: 1 } }],
  },
  schemaOptions(),
)

export type Cart = InferSchemaType<typeof cartSchema>
export const CartModel = model("Cart", cartSchema)

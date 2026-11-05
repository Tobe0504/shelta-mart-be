import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const productStatuses = ["live", "draft", "out-of-stock"] as const

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, index: true },
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    /** Base unit price in naira. */
    price: { type: Number, required: true, min: 0 },
    /** Previous price, shown struck through when on sale. */
    was: { type: Number, min: 0 },
    unit: { type: String, required: true },
    tiers: [{ _id: false, label: String, min: { type: Number, required: true, min: 1 }, price: { type: Number, required: true, min: 0 } }],
    stock: { type: Number, default: 0, min: 0 },
    deliveryDays: { type: Number, default: 1, min: 0 },
    specs: [{ _id: false, label: { type: String, required: true }, value: { type: String, required: true } }],
    images: [String],
    description: { type: String, trim: true },
    status: { type: String, enum: productStatuses, default: "draft", index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  schemaOptions(),
)

productSchema.index({ name: "text", brand: "text" })
productSchema.index({ status: 1, category: 1, price: 1 })

export type Product = InferSchemaType<typeof productSchema>
export const ProductModel = model("Product", productSchema)

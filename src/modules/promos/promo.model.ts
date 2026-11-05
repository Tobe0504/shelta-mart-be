import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const promoThemes = ["primary", "dark", "deal", "success"] as const
export const promoIcons = ["cement", "rods", "roof", "truck", "quote", "paint", "tiles", "solar", "safety"] as const

/** A banner in the home and search carousels. `category` targets a category's search page. */
const promoSchema = new Schema(
  {
    badge: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    cta: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
    theme: { type: String, enum: promoThemes, default: "primary" },
    icon: { type: String, enum: promoIcons, default: "cement" },
    category: { type: String, index: true },
    sponsor: { type: String, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
  },
  schemaOptions(),
)

export type Promo = InferSchemaType<typeof promoSchema>
export const PromoModel = model("Promo", promoSchema)

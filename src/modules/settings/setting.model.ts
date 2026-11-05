import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

/** Marketplace-wide fees and rules. A single document keyed "marketplace"; edited by admins. */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "marketplace" },
    /** Default commission SheltaMart keeps from each shipment's goods value (0.05 = 5%). */
    commissionRate: { type: Number, default: 0.05, min: 0, max: 1 },
    /** Per-category overrides of `commissionRate`. */
    categoryCommission: [{ _id: false, category: { type: String, required: true }, rate: { type: Number, required: true, min: 0, max: 1 } }],
    /** Flat fee per shipment for an offloading crew. */
    offloadFee: { type: Number, default: 5_000, min: 0 },
    /** Flat service fee added to every order (0 = none). */
    serviceFee: { type: Number, default: 0, min: 0 },
    /** Delivery price per truck: base + per km, never below the minimum. Distance = straight line × road factor. */
    deliveryBaseFee: { type: Number, default: 5_000, min: 0 },
    deliveryPerKm: { type: Number, default: 800, min: 0 },
    deliveryMinFee: { type: Number, default: 8_000, min: 0 },
    roadFactor: { type: Number, default: 1.3, min: 1, max: 3 },
    /** Furthest a seller delivers, in road kilometres. */
    maxDeliveryKm: { type: Number, default: 100, min: 1 },
    /** Delivery windows offered at checkout, and how many days ahead they're bookable. */
    deliveryWindows: { type: [String], default: ["8–12", "12–4"] },
    deliveryDaysAhead: { type: Number, default: 4, min: 1, max: 14 },
    /** Hours after the buyer confirms delivery before the seller is paid out. */
    payoutDelayHours: { type: Number, default: 0, min: 0 },
  },
  schemaOptions(),
)

export type Settings = InferSchemaType<typeof settingSchema>
export const SettingModel = model("Setting", settingSchema)

import { model, Schema, type InferSchemaType } from "mongoose"
import { coordsField } from "../../lib/geo.ts"
import { schemaOptions } from "../../lib/schema.ts"

export const paymentMethods = ["transfer", "card", "ussd"] as const
export const paymentStatuses = ["pending", "paid", "failed", "refunded"] as const
/** Shipment lifecycle, in order. `pending_payment` until the order is paid; `cancelled` can happen before dispatch. */
export const shipmentStatuses = ["pending_payment", "placed", "confirmed", "loaded", "on_the_way", "delivered", "cancelled"] as const
export const payoutStatuses = ["not_due", "pending", "paid", "failed"] as const

export type ShipmentStatus = (typeof shipmentStatuses)[number]

const lineSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false },
)

const shipmentSchema = new Schema({
  store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  storeName: { type: String, required: true },
  lines: { type: [lineSchema], required: true },
  /** Delivered to the site, or collected by the buyer from the store. */
  fulfilment: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
  /** Where to collect from, for pickups. */
  pickupAddress: String,
  slot: { type: String, required: true },
  offload: { type: Boolean, default: false },
  goods: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  distanceKm: Number,
  offloadFee: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  /** Commission and payout fixed at checkout, so later fee changes don't affect this order. */
  commissionRate: { type: Number, required: true },
  commission: { type: Number, required: true },
  payout: { type: Number, required: true },
  status: { type: String, enum: shipmentStatuses, default: "pending_payment" },
  history: [{ _id: false, status: { type: String, enum: shipmentStatuses }, at: { type: Date, default: Date.now } }],
  driver: { name: String, truck: String, phone: String },
  issue: { reason: String, message: String, at: Date },
  payoutStatus: { type: String, enum: payoutStatuses, default: "not_due" },
  payoutDueAt: Date,
  payoutReference: String,
}, { toJSON: schemaOptions().toJSON })

const orderSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Snapshot of the delivery site at checkout. */
    site: {
      label: String,
      address: { type: String, required: true },
      area: String,
      coords: coordsField,
      contactName: String,
      contactPhone: String,
    },
    paymentMethod: { type: String, enum: paymentMethods, required: true },
    payment: {
      status: { type: String, enum: paymentStatuses, default: "pending" },
      reference: { type: String, index: true },
      attempts: { type: Number, default: 0 },
      paidAt: Date,
    },
    subtotal: { type: Number, required: true },
    delivery: { type: Number, required: true },
    offload: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    shipments: { type: [shipmentSchema], required: true },
  },
  schemaOptions(),
)

orderSchema.index({ "shipments.store": 1, "shipments.status": 1 })

export type Order = InferSchemaType<typeof orderSchema>
export const OrderModel = model("Order", orderSchema)

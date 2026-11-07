import { z } from "zod"
import { objectId, pagination, phone, text } from "../../lib/validation.ts"
import { paymentMethods, shipmentStatuses } from "./order.model.ts"

export const orderNumber = z.string().regex(/^SM-\d{6}$/, "Invalid order number")

export const createOrderSchema = z.object({
  siteId: objectId,
  paymentMethod: z.enum(paymentMethods),
  /** Delivery choices per store in the cart. */
  shipments: z.array(z.object({ store: objectId, slot: text(60), offload: z.boolean().default(false), fulfilment: z.enum(["delivery", "pickup"]).default("delivery") })).min(1),
})

export const listOrdersSchema = pagination.extend({ status: z.enum(shipmentStatuses).optional() })
export const rescheduleSchema = z.object({ slot: text(60) })
export const reportSchema = z.object({ reason: text(80), message: z.string().trim().max(1000).default("") })
export const dispatchSchema = z.object({ name: text(80), truck: text(20), phone })
export const declineSchema = z.object({ reason: text(200) })

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type ListOrdersInput = z.infer<typeof listOrdersSchema>
export type ReportInput = z.infer<typeof reportSchema>
export type DispatchInput = z.infer<typeof dispatchSchema>

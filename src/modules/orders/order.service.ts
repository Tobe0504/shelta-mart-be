import { randomInt } from "node:crypto"
import { env } from "../../config/env.ts"
import { badRequest, conflict, notFound } from "../../lib/errors.ts"
import { logger } from "../../lib/logger.ts"
import { paged, skip } from "../../lib/paginate.ts"
import * as paystack from "../../lib/paystack.ts"
import { percentOf } from "../../lib/pricing.ts"
import { loadLines, removeProducts } from "../cart/cart.service.ts"
import { ProductModel } from "../products/product.model.ts"
import { commissionFor, deliverySlots, getSettings } from "../settings/setting.service.ts"
import { getSite } from "../sites/site.service.ts"
import { StoreModel } from "../stores/store.model.ts"
import { getOwnStore } from "../stores/store.service.ts"
import { UserModel } from "../users/user.model.ts"
import { OrderModel, type ShipmentStatus } from "./order.model.ts"
import { quoteDelivery } from "./delivery.ts"
import { priceLines } from "./order.pricing.ts"
import type { CreateOrderInput, DispatchInput, ListOrdersInput, ReportInput } from "./order.schema.ts"

type OrderDoc = NonNullable<Awaited<ReturnType<typeof OrderModel.findOne>>>
type ShipmentDoc = OrderDoc["shipments"][number]

const channels: Record<string, paystack.Channel[]> = { transfer: ["bank_transfer"], card: ["card"], ussd: ["ussd"] }
const callbackUrl = () => `${env.CLIENT_URL}/checkout/complete`

async function newOrderNumber() {
  for (let i = 0; i < 5; i++) {
    const number = `SM-${randomInt(100_000, 1_000_000)}`
    if (!(await OrderModel.exists({ number }))) return number
  }
  throw conflict("Couldn’t allocate an order number. Please try again.")
}

// ——— Checkout and payment ———

export async function createOrder(buyerId: string, input: CreateOrderInput) {
  const [buyer, site, settings, lines] = await Promise.all([UserModel.findById(buyerId).orFail(), getSite(buyerId, input.siteId), getSettings(), loadLines(buyerId)])
  if (!lines.length) throw badRequest("Your cart is empty")
  for (const { product, qty } of lines) {
    if (product.status !== "live") throw badRequest(`${product.name} is no longer available`)
    if (qty > product.stock) throw badRequest(`Only ${product.stock} ${product.unit}s of ${product.name} left`)
  }

  const slots = deliverySlots(settings)
  const choices = new Map(input.shipments.map((s) => [s.store, s]))
  const priced = priceLines(lines, {
    deliveryFor: (store) => quoteDelivery(settings, store.coords, site.coords),
    offloadFee: settings.offloadFee,
    offloadFor: (id) => choices.get(id)?.offload ?? false,
  })

  const shipments = priced.shipments.map((s) => {
    const choice = choices.get(s.store.id)
    if (!choice) throw badRequest(`Choose a delivery slot for ${s.store.name}`)
    if (!s.inRange) throw badRequest(`${s.store.name} doesn’t deliver that far (${s.distanceKm} km). Remove their items or choose a closer site.`)
    if (!slots.includes(choice.slot)) throw badRequest(`“${choice.slot}” is no longer available. Pick another slot.`)
    const commission = s.items.reduce((n, i) => n + percentOf(i.total, commissionFor(settings, i.product.category)), 0)
    return {
      store: s.store.id,
      storeName: s.store.name,
      lines: s.items.map((i) => ({ product: i.product.id, slug: i.product.slug, name: i.product.name, unit: i.product.unit, qty: i.qty, unitPrice: i.unitPrice, total: i.total })),
      slot: choice.slot,
      offload: choice.offload,
      goods: s.goods,
      deliveryFee: s.delivery,
      distanceKm: s.distanceKm ?? undefined,
      offloadFee: s.offload,
      amount: s.amount,
      commissionRate: s.goods ? commission / s.goods : 0,
      commission,
      payout: s.amount - commission,
      history: [{ status: "pending_payment" as const }],
    }
  })

  const number = await newOrderNumber()
  const order = await OrderModel.create({
    number,
    buyer: buyerId,
    site: { label: site.label, address: site.address, area: site.area, coords: site.coords, contactName: site.contactName, contactPhone: site.contactPhone },
    paymentMethod: input.paymentMethod,
    payment: { reference: `${number}-1`, attempts: 1 },
    subtotal: priced.subtotal,
    delivery: priced.delivery,
    offload: priced.offload,
    serviceFee: settings.serviceFee,
    total: priced.total + settings.serviceFee,
    shipments,
  })
  return { order, payment: await startPayment(order, buyer.email) }
}

const startPayment = (order: OrderDoc, email: string) =>
  paystack.initializeTransaction({
    email,
    amount: order.total,
    reference: order.payment!.reference!,
    channels: channels[order.paymentMethod] ?? ["card"],
    callbackUrl: callbackUrl(),
    metadata: { orderNumber: order.number },
  })

/** Starts a fresh payment attempt for an unpaid order (references can't be reused). */
export async function retryPayment(buyerId: string, number: string) {
  const order = await getForBuyer(buyerId, number)
  if (order.payment?.status === "paid") throw conflict("This order is already paid")
  const attempts = (order.payment?.attempts ?? 0) + 1
  order.set({ payment: { status: "pending", attempts, reference: `${order.number}-${attempts}` } })
  await order.save()
  const buyer = await UserModel.findById(buyerId).orFail()
  return { order, payment: await startPayment(order, buyer.email) }
}

/** Marks the order paid and releases it to sellers. Safe to call more than once for the same reference. */
export async function markPaid(reference: string, amountPaid: number) {
  const order = await OrderModel.findOne({ "payment.reference": reference })
  if (!order || order.payment?.status === "paid") return order
  if (amountPaid < order.total) {
    logger.error({ reference, amountPaid, total: order.total }, "Underpaid order")
    order.set({ "payment.status": "failed" })
    return order.save()
  }
  order.set({ "payment.status": "paid", "payment.paidAt": new Date() })
  for (const shipment of order.shipments) move(shipment, "placed")
  await order.save()

  const lines = order.shipments.flatMap((s) => s.lines)
  await ProductModel.bulkWrite(lines.map((l) => ({ updateOne: { filter: { _id: l.product }, update: { $inc: { stock: -l.qty } } } })))
  await ProductModel.updateMany({ _id: { $in: lines.map((l) => l.product) }, stock: { $lte: 0 }, status: "live" }, { status: "out-of-stock", stock: 0 })
  await removeProducts(String(order.buyer), lines.map((l) => String(l.product)))
  return order
}

/** Called from the payment callback page: confirms with Paystack, then marks the order paid. */
export async function verifyPayment(buyerId: string, reference: string) {
  const order = await OrderModel.findOne({ buyer: buyerId, "payment.reference": reference })
  if (!order) throw notFound("Order")
  if (order.payment?.status === "paid") return order
  const paid = await paystack.verifyTransaction(reference, order.total)
  return paid === null ? order : ((await markPaid(reference, paid)) ?? order)
}

// ——— Buyer ———

export async function listForBuyer(buyerId: string, { status, ...page }: ListOrdersInput) {
  const filter = { buyer: buyerId, ...(status && { "shipments.status": status }) }
  const [items, total] = await Promise.all([OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit), OrderModel.countDocuments(filter)])
  return paged(items, total, page)
}

export async function getForBuyer(buyerId: string, number: string) {
  const order = await OrderModel.findOne({ buyer: buyerId, number })
  if (!order) throw notFound("Order")
  return order
}

export async function confirmDelivery(buyerId: string, number: string, shipmentId: string) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  move(shipment, "delivered")
  const { payoutDelayHours } = await getSettings()
  shipment.set({ payoutStatus: "pending", payoutDueAt: new Date(Date.now() + payoutDelayHours * 3_600_000) })
  await order.save()
  if (!payoutDelayHours) await payShipment(order, shipment)
  return order
}

export async function reschedule(buyerId: string, number: string, shipmentId: string, slot: string) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  if (!["placed", "confirmed"].includes(shipment.status)) throw badRequest("This delivery can no longer be rescheduled")
  if (!deliverySlots(await getSettings()).includes(slot)) throw badRequest("That slot isn’t available")
  shipment.slot = slot
  return order.save()
}

export async function reportIssue(buyerId: string, number: string, shipmentId: string, input: ReportInput) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  if (shipment.status === "pending_payment") throw badRequest("Pay for this order before reporting a problem")
  shipment.issue = { ...input, at: new Date() }
  return order.save()
}

// ——— Seller ———

/** Orders containing the seller's shipments, each reduced to just those shipments. */
export async function listForSeller(owner: string, { status, ...page }: ListOrdersInput) {
  const store = await getOwnStore(owner)
  const match = status ? { store: store._id, status } : { store: store._id, status: { $ne: "pending_payment" } }
  const filter = { shipments: { $elemMatch: match } }
  const [orders, total] = await Promise.all([OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit), OrderModel.countDocuments(filter)])
  const items = orders.map((o) => ({
    number: o.number,
    placedAt: o.get("createdAt") as Date,
    site: o.site,
    paymentMethod: o.paymentMethod,
    shipments: o.shipments.filter((s) => String(s.store) === store.id && (!status || s.status === status)),
  }))
  return paged(items, total, page)
}

async function getSellerShipment(owner: string, number: string, shipmentId: string) {
  const store = await getOwnStore(owner)
  const order = await OrderModel.findOne({ number, "shipments.store": store._id })
  if (!order) throw notFound("Order")
  const shipment = findShipment(order, shipmentId)
  if (String(shipment.store) !== store.id) throw notFound("Shipment")
  return { order, shipment }
}

export async function accept(owner: string, number: string, shipmentId: string) {
  const { order, shipment } = await getSellerShipment(owner, number, shipmentId)
  move(shipment, "confirmed")
  return order.save()
}

export async function markLoaded(owner: string, number: string, shipmentId: string) {
  const { order, shipment } = await getSellerShipment(owner, number, shipmentId)
  move(shipment, "loaded")
  return order.save()
}

export async function dispatch(owner: string, number: string, shipmentId: string, driver: DispatchInput) {
  const { order, shipment } = await getSellerShipment(owner, number, shipmentId)
  move(shipment, "on_the_way")
  shipment.driver = driver
  return order.save()
}

/** Seller can't fulfil: cancels the shipment and refunds the buyer for it. */
export async function decline(owner: string, number: string, shipmentId: string, reason: string) {
  const { order, shipment } = await getSellerShipment(owner, number, shipmentId)
  move(shipment, "cancelled")
  shipment.issue = { reason: "Declined by seller", message: reason, at: new Date() }
  await order.save()
  await paystack.refund(order.payment!.reference!, shipment.amount)
  if (order.shipments.every((s) => s.status === "cancelled")) order.set({ "payment.status": "refunded" })
  await ProductModel.bulkWrite(shipment.lines.map((l) => ({ updateOne: { filter: { _id: l.product }, update: { $inc: { stock: l.qty } } } })))
  return order.save()
}

// ——— Status rules ———

const nextAllowed: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  pending_payment: ["placed"],
  placed: ["confirmed", "cancelled"],
  confirmed: ["loaded", "cancelled"],
  loaded: ["on_the_way"],
  on_the_way: ["delivered"],
}

function move(shipment: ShipmentDoc, to: ShipmentStatus) {
  if (!nextAllowed[shipment.status]?.includes(to)) throw badRequest(`A ${shipment.status.replace("_", " ")} delivery can’t be marked ${to.replace("_", " ")}`)
  shipment.status = to
  shipment.history.push({ status: to, at: new Date() })
}

function findShipment(order: OrderDoc, id: string) {
  const shipment = order.shipments.id(id)
  if (!shipment) throw notFound("Shipment")
  return shipment
}

// ——— Payouts ———

/** Sends the seller their share for a delivered shipment. Leaves it pending if they haven't added a bank account. */
async function payShipment(order: OrderDoc, shipment: ShipmentDoc) {
  const store = await StoreModel.findById(shipment.store)
  const recipientCode = store?.payout?.recipientCode
  if (!recipientCode) return
  const reference = `${order.number}-${String(shipment._id)}`
  try {
    await paystack.transfer({ amount: shipment.payout, recipientCode, reference, reason: `SheltaMart order ${order.number}` })
    shipment.set({ payoutStatus: "paid", payoutReference: reference })
  } catch (err) {
    logger.error({ err, reference }, "Payout failed")
    shipment.set({ payoutStatus: "failed", payoutReference: reference })
  }
  await order.save()
}

/** Pays every shipment whose payout is due. Run on a schedule, or from the admin endpoint. */
export async function processDuePayouts() {
  const orders = await OrderModel.find({ shipments: { $elemMatch: { payoutStatus: { $in: ["pending", "failed"] }, payoutDueAt: { $lte: new Date() } } } })
  let paid = 0
  for (const order of orders)
    for (const shipment of order.shipments)
      if (["pending", "failed"].includes(shipment.payoutStatus) && shipment.payoutDueAt && shipment.payoutDueAt <= new Date()) {
        await payShipment(order, shipment)
        if (shipment.payoutStatus === "paid") paid++
      }
  return { paid }
}

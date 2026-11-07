import type { Types } from "mongoose"
import { randomInt } from "node:crypto"
import { env } from "../../config/env.ts"
import { badRequest, conflict, notFound } from "../../lib/errors.ts"
import { logger } from "../../lib/logger.ts"
import { paged, skip } from "../../lib/paginate.ts"
import * as paystack from "../../lib/paystack.ts"
import { percentOf } from "../../lib/pricing.ts"
import { loadLines, removeProducts } from "../cart/cart.service.ts"
import { notify } from "../notifications/notification.service.ts"
import { ProductModel } from "../products/product.model.ts"
import { commissionFor, getSettings, storeOffloadFee, storeSlots } from "../settings/setting.service.ts"
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

  const stores = new Map(lines.map(({ product }) => [product.store.id, product.store]))
  const choices = new Map(input.shipments.map((s) => [s.store, s]))
  for (const [id, choice] of choices) if (choice.fulfilment === "pickup" && !stores.get(id)?.pickup) throw badRequest(`${stores.get(id)?.name ?? "This store"} doesn’t offer pickup`)
  const priced = priceLines(lines, {
    deliveryFor: (store) => quoteDelivery(settings, store.coords, site.coords),
    offloadFeeFor: (id) => storeOffloadFee(stores.get(id)!, settings),
    offloadFor: (id) => choices.get(id)?.offload ?? false,
    fulfilmentFor: (id) => choices.get(id)?.fulfilment ?? "delivery",
  })

  const shipments = priced.shipments.map((s) => {
    const choice = choices.get(s.store.id)
    const store = stores.get(s.store.id)!
    if (!choice) throw badRequest(`Choose a delivery slot for ${s.store.name}`)
    if (!s.inRange) throw badRequest(`${s.store.name} doesn’t deliver that far (${s.distanceKm} km). Choose pickup, a closer site, or remove their items.`)
    if (!storeSlots(store, settings).includes(choice.slot)) throw badRequest(`“${choice.slot}” is no longer available. Pick another slot.`)
    const commission = s.items.reduce((n, i) => n + percentOf(i.total, commissionFor(settings, i.product.category)), 0)
    return {
      store: s.store.id,
      storeName: s.store.name,
      lines: s.items.map((i) => ({ product: i.product.id, slug: i.product.slug, name: i.product.name, unit: i.product.unit, qty: i.qty, unitPrice: i.unitPrice, total: i.total })),
      fulfilment: s.fulfilment,
      pickupAddress: s.fulfilment === "pickup" ? (store.address ?? store.location ?? undefined) : undefined,
      slot: choice.slot,
      offload: s.offload > 0,
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
  const stores = await StoreModel.find({ _id: { $in: order.shipments.map((s) => s.store) } }).select("owner")
  await Promise.all(
    stores.map((store) => {
      const shipment = order.shipments.find((s) => String(s.store) === String(store._id))!
      return notify(store.owner, { kind: "order", title: `New order ${order.number}`, body: `${shipment.lines.length} ${shipment.lines.length === 1 ? "item" : "items"} · ${shipment.fulfilment === "pickup" ? "buyer collects" : "deliver"} ${shipment.slot}. Accept it to confirm.`, href: "/seller/orders" })
    }),
  )

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
  if (!payoutDelayHours) await payShipment(order, shipment, true)
  return order
}

/** Times the buyer can move a delivery (or pickup) to, from that store's own schedule. */
export async function slotsFor(buyerId: string, number: string, shipmentId: string) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  const [settings, store] = await Promise.all([getSettings(), StoreModel.findById(shipment.store).lean()])
  return storeSlots(store ?? {}, settings)
}

export async function reschedule(buyerId: string, number: string, shipmentId: string, slot: string) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  if (!["placed", "confirmed"].includes(shipment.status)) throw badRequest("This delivery can no longer be rescheduled")
  const [settings, store] = await Promise.all([getSettings(), StoreModel.findById(shipment.store).lean()])
  if (!storeSlots(store ?? {}, settings).includes(slot)) throw badRequest("That slot isn’t available")
  shipment.slot = slot
  return order.save()
}

export async function reportIssue(buyerId: string, number: string, shipmentId: string, input: ReportInput) {
  const order = await getForBuyer(buyerId, number)
  const shipment = findShipment(order, shipmentId)
  if (shipment.status === "pending_payment") throw badRequest("Pay for this order before reporting a problem")
  shipment.issue = { ...input, at: new Date() }
  await order.save()
  const admins = await UserModel.find({ role: "admin" }).distinct("_id")
  await notify(admins, { kind: "order", title: `Problem reported on ${order.number}`, body: `${input.reason} · ${shipment.storeName}. The payment is held in escrow.`, href: "/admin/escrow" })
  return order
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

// ——— Admin escrow ———

const HELD: ShipmentStatus[] = ["placed", "confirmed", "loaded", "on_the_way"]

/** Paid orders with money still in escrow, a reported problem, or a payout that hasn't gone out. */
export const listEscrowOrders = () =>
  OrderModel.find({
    "payment.status": "paid",
    shipments: { $elemMatch: { $or: [{ status: { $in: HELD } }, { payoutStatus: { $in: ["pending", "failed"] } }] } },
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .populate("buyer", "name email phone")

async function adminShipment(number: string, shipmentId: string) {
  const order = await OrderModel.findOne({ number })
  if (!order) throw notFound("Order")
  return { order, shipment: findShipment(order, shipmentId) }
}

/** Settles a held delivery in the seller's favour, as if the buyer had confirmed it. */
export async function adminRelease(number: string, shipmentId: string) {
  const { order, shipment } = await adminShipment(number, shipmentId)
  if (!HELD.includes(shipment.status)) throw conflict("Only money still in escrow can be released")
  const { payoutDelayHours } = await getSettings()
  shipment.status = "delivered"
  shipment.history.push({ status: "delivered", at: new Date() })
  shipment.set({ issue: undefined, payoutStatus: "pending", payoutDueAt: new Date(Date.now() + payoutDelayHours * 3_600_000) })
  await order.save()
  if (!payoutDelayHours) await payShipment(order, shipment, true)
  await notify(order.buyer, { kind: "order", title: `Order ${order.number} settled`, body: `SheltaMart released ${shipment.storeName}’s payment.`, href: `/orders/${order.number}` })
  return order
}

/** Settles a held delivery in the buyer's favour: refunds it through Paystack and returns the stock. */
export async function adminRefund(number: string, shipmentId: string) {
  const { order, shipment } = await adminShipment(number, shipmentId)
  if (!HELD.includes(shipment.status)) throw conflict("Only money still in escrow can be refunded")
  await paystack.refund(order.payment!.reference!, shipment.amount)
  shipment.status = "cancelled"
  shipment.history.push({ status: "cancelled", at: new Date() })
  shipment.issue = { reason: "Refunded by SheltaMart", message: shipment.issue?.message ?? "", at: new Date() }
  if (order.shipments.every((s) => s.status === "cancelled")) order.set({ "payment.status": "refunded" })
  await order.save()
  await ProductModel.bulkWrite(shipment.lines.map((l) => ({ updateOne: { filter: { _id: l.product }, update: { $inc: { stock: l.qty } } } })))
  const store = await StoreModel.findById(shipment.store).select("owner")
  await notify(order.buyer, { kind: "order", title: `Refund started for ${order.number}`, body: `₦${shipment.amount.toLocaleString("en-NG")} for ${shipment.storeName}’s delivery is on its way back to you.`, href: `/orders/${order.number}` })
  await notify(store?.owner, { kind: "order", title: `Order ${order.number} refunded`, body: "SheltaMart refunded the buyer after looking into a problem.", href: "/seller/orders" })
  return order
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
  // A pickup goes from "ready" (loaded) straight to collected.
  const allowed = shipment.fulfilment === "pickup" && shipment.status === "loaded" ? ["delivered"] : nextAllowed[shipment.status]
  if (!allowed?.includes(to)) throw badRequest(`A ${shipment.status.replace("_", " ")} delivery can’t be marked ${to.replace("_", " ")}`)
  shipment.status = to
  shipment.history.push({ status: to, at: new Date() })
}

function findShipment(order: OrderDoc, id: string) {
  const shipment = order.shipments.id(id)
  if (!shipment) throw notFound("Shipment")
  return shipment
}

// ——— Payouts ———

/**
 * Sends the seller their share for a delivered shipment. Without a bank account it stays pending and
 * (with `remind`) they're asked to add one; adding it pays everything waiting (see `payPendingForStore`).
 */
async function payShipment(order: OrderDoc, shipment: ShipmentDoc, remind = false) {
  const store = await StoreModel.findById(shipment.store)
  const recipientCode = store?.payout?.recipientCode
  if (!recipientCode) {
    if (remind && store) await notify(store.owner, { kind: "payout", title: "Add your bank account to get paid", body: `₦${shipment.payout.toLocaleString("en-NG")} for order ${order.number} is waiting. It’s sent as soon as you add your account.`, href: "/seller/settings" })
    return
  }
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

/** Pays everything waiting for a store, right after it adds a bank account. */
export async function payPendingForStore(storeId: Types.ObjectId) {
  const orders = await OrderModel.find({ shipments: { $elemMatch: { store: storeId, payoutStatus: { $in: ["pending", "failed"] } } } })
  let paid = 0
  for (const order of orders)
    for (const shipment of order.shipments)
      if (String(shipment.store) === String(storeId) && ["pending", "failed"].includes(shipment.payoutStatus)) {
        await payShipment(order, shipment)
        if (shipment.payoutStatus === "paid") paid++
      }
  return paid
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

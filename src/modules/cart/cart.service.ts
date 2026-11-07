import { Types } from "mongoose"
import { badRequest, notFound } from "../../lib/errors.ts"
import type { Coords, MaybeCoords } from "../../lib/geo.ts"
import { quoteDelivery } from "../orders/delivery.ts"
import { priceLines, type PricedProduct, type StoreRules } from "../orders/order.pricing.ts"
import { getSettings, storeOffloadFee, storeSlots } from "../settings/setting.service.ts"
import { ProductModel } from "../products/product.model.ts"
import { CartModel } from "./cart.model.ts"
import type { MergeInput } from "./cart.schema.ts"

/** Store fields checkout needs: location, delivery rules, offloading and pickup. */
const STORE_RULES = "name coords address location deliveryWindows deliveryDays deliveryDaysAhead offloadFee pickup pickupHours"

type LoadedProduct = PricedProduct & { stock: number; status: string; images: string[]; was?: number | null }

/** Cart lines with live products and their stores loaded; lines for removed or draft products are dropped. */
export async function loadLines(user: string) {
  const cart = await CartModel.findOne({ user }).lean()
  if (!cart?.lines.length) return []
  const products = await ProductModel.find({ _id: { $in: cart.lines.map((l) => l.product) }, status: { $ne: "draft" } })
    .populate<{ store: StoreRules & { _id: Types.ObjectId; name: string; coords?: MaybeCoords } }>("store", STORE_RULES)
    .lean()
  const byId = new Map(products.map((p) => [String(p._id), p]))
  return cart.lines.flatMap(({ product: id, qty }) => {
    const p = byId.get(String(id))
    if (!p) return []
    const { _id, ...store } = p.store
    const product: LoadedProduct = { ...p, id: String(p._id), store: { ...store, id: String(_id) } }
    return [{ product, qty }]
  })
}

/**
 * The cart, priced. Pass the delivery point to price each truck by distance.
 * Each shipment carries its store's checkout options: delivery slots, offloading price and pickup details.
 */
export async function getCart(user: string, to?: Coords) {
  const [lines, settings] = await Promise.all([loadLines(user), getSettings()])
  const stores = new Map(lines.map(({ product }) => [product.store.id, product.store]))
  const priced = priceLines(lines, { deliveryFor: (store) => quoteDelivery(settings, store.coords, to) })
  const summary = {
    ...priced,
    shipments: priced.shipments.map((s) => {
      const store = stores.get(s.store.id)!
      return {
        ...s,
        options: {
          slots: storeSlots(store, settings),
          offloadFee: storeOffloadFee(store, settings),
          pickup: store.pickup ? { address: store.address ?? store.location ?? "", hours: store.pickupHours ?? undefined } : null,
        },
      }
    }),
  }
  return { lines: lines.map(({ product: { store, ...product }, qty }) => ({ product: { ...product, store: { id: store.id, name: store.name } }, qty })), summary }
}

/** Sets a line's quantity; 0 removes it. */
export async function setLine(user: string, productId: string, qty: number) {
  if (qty > 0) {
    const product = await ProductModel.findOne({ _id: productId, status: "live" }).lean()
    if (!product) throw notFound("Product")
    if (qty > product.stock) throw badRequest(`Only ${product.stock} ${product.unit}s in stock`)
  }
  const cart = (await CartModel.findOne({ user })) ?? new CartModel({ user, lines: [] })
  const lines = cart.lines.filter((l) => String(l.product) !== productId).map(({ product, qty }) => ({ product, qty }))
  if (qty > 0) lines.push({ product: new Types.ObjectId(productId), qty })
  cart.set({ lines })
  await cart.save()
  return getCart(user)
}

/** Adds a signed-out cart (kept in the browser) to the account's cart. */
export async function mergeLines(user: string, { lines }: MergeInput) {
  const products = await ProductModel.find({ slug: { $in: lines.map((l) => l.slug) }, status: "live" }).lean()
  const cart = (await CartModel.findOne({ user })) ?? new CartModel({ user, lines: [] })
  for (const { slug, qty } of lines) {
    const product = products.find((p) => p.slug === slug)
    if (!product) continue
    const existing = cart.lines.find((l) => String(l.product) === String(product._id))
    const capped = Math.min(product.stock, (existing?.qty ?? 0) + qty)
    if (existing) existing.qty = capped
    else if (capped > 0) cart.lines.push({ product: product._id, qty: capped })
  }
  await cart.save()
  return getCart(user)
}

export const clearCart = (user: string) => CartModel.updateOne({ user }, { lines: [] })

/** Removes just these products from the cart, e.g. after they were ordered. */
export const removeProducts = (user: string, productIds: string[]) => CartModel.updateOne({ user }, { $pull: { lines: { product: { $in: productIds } } } })

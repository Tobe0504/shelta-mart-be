import type { MaybeCoords } from "../../lib/geo.ts"
import { unitPrice } from "../../lib/pricing.ts"
import type { DeliveryQuote } from "./delivery.ts"

/** The product fields pricing needs, with its store resolved. */
export type PricedProduct = {
  id: string
  slug: string
  name: string
  unit: string
  price: number
  tiers?: { min: number; price: number }[] | null
  category: string
  store: { id: string; name: string; coords?: MaybeCoords }
}

export type PricedItem = { product: PricedProduct; qty: number; unitPrice: number; total: number; saving: number }
export type PricedShipment = {
  store: { id: string; name: string }
  items: PricedItem[]
  goods: number
  delivery: number
  /** Road kilometres from the store; null when either location is unknown. */
  distanceKm: number | null
  inRange: boolean
  offload: number
  amount: number
}

/**
 * Groups lines into one shipment per store and totals them.
 * Each shipment pays `deliveryFor(store)` (distance-based), plus the offload fee when `offloadFor(storeId)` is true.
 */
export function priceLines(
  lines: { product: PricedProduct; qty: number }[],
  {
    deliveryFor = () => ({ fee: 0, distanceKm: null, inRange: true }),
    offloadFee = 0,
    offloadFor = () => false,
  }: { deliveryFor?: (store: PricedProduct["store"]) => DeliveryQuote; offloadFee?: number; offloadFor?: (storeId: string) => boolean } = {},
) {
  const byStore = new Map<string, PricedShipment>()
  for (const { product, qty } of lines) {
    const unit = unitPrice(product, qty)
    const item = { product, qty, unitPrice: unit, total: unit * qty, saving: (product.price - unit) * qty }
    const quote = byStore.has(product.store.id) ? null : deliveryFor(product.store)
    const shipment = byStore.get(product.store.id) ?? {
      store: { id: product.store.id, name: product.store.name },
      items: [],
      goods: 0,
      delivery: quote!.fee,
      distanceKm: quote!.distanceKm,
      inRange: quote!.inRange,
      offload: offloadFor(product.store.id) ? offloadFee : 0,
      amount: 0,
    }
    shipment.items.push(item)
    shipment.goods += item.total
    shipment.amount = shipment.goods + shipment.delivery + shipment.offload
    byStore.set(product.store.id, shipment)
  }
  const shipments = [...byStore.values()]
  const sum = (pick: (s: PricedShipment) => number) => shipments.reduce((n, s) => n + pick(s), 0)
  return {
    shipments,
    itemCount: lines.length,
    subtotal: sum((s) => s.goods),
    delivery: sum((s) => s.delivery),
    offload: sum((s) => s.offload),
    savings: sum((s) => s.items.reduce((n, i) => n + i.saving, 0)),
    total: sum((s) => s.amount),
  }
}

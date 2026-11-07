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
  store: StoreRules & { id: string; name: string; coords?: MaybeCoords }
}

/** A store's own delivery and pickup settings, as loaded with its products. */
export type StoreRules = {
  address?: string | null
  location?: string | null
  deliveryWindows?: string[] | null
  deliveryDays?: number[] | null
  deliveryDaysAhead?: number | null
  offloadFee?: number | null
  pickup?: boolean | null
  pickupHours?: string | null
}

export type Fulfilment = "delivery" | "pickup"

export type PricedItem = { product: PricedProduct; qty: number; unitPrice: number; total: number; saving: number }
export type PricedShipment = {
  store: { id: string; name: string }
  fulfilment: Fulfilment
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
 * Each delivered shipment pays `deliveryFor(store)` (distance-based), plus the store's offload fee when `offloadFor(storeId)` is true.
 * Collected shipments (`fulfilmentFor(storeId) === "pickup"`) pay neither.
 */
export function priceLines(
  lines: { product: PricedProduct; qty: number }[],
  {
    deliveryFor = () => ({ fee: 0, distanceKm: null, inRange: true }),
    offloadFeeFor = () => 0,
    offloadFor = () => false,
    fulfilmentFor = () => "delivery",
  }: {
    deliveryFor?: (store: PricedProduct["store"]) => DeliveryQuote
    offloadFeeFor?: (storeId: string) => number
    offloadFor?: (storeId: string) => boolean
    fulfilmentFor?: (storeId: string) => Fulfilment
  } = {},
) {
  const byStore = new Map<string, PricedShipment>()
  for (const { product, qty } of lines) {
    const unit = unitPrice(product, qty)
    const item = { product, qty, unitPrice: unit, total: unit * qty, saving: (product.price - unit) * qty }
    const id = product.store.id
    const pickup = fulfilmentFor(id) === "pickup"
    const quote = byStore.has(id) ? null : deliveryFor(product.store)
    const shipment = byStore.get(id) ?? {
      store: { id, name: product.store.name },
      fulfilment: pickup ? "pickup" : "delivery",
      items: [],
      goods: 0,
      delivery: pickup ? 0 : quote!.fee,
      distanceKm: quote!.distanceKm,
      inRange: pickup || quote!.inRange,
      offload: !pickup && offloadFor(id) ? offloadFeeFor(id) : 0,
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

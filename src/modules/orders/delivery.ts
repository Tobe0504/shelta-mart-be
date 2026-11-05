import { haversineKm, hasCoords, type MaybeCoords } from "../../lib/geo.ts"
import type { Settings } from "../settings/setting.model.ts"

export type DeliveryRates = Pick<Settings, "deliveryBaseFee" | "deliveryPerKm" | "deliveryMinFee" | "roadFactor" | "maxDeliveryKm">
export type DeliveryQuote = { fee: number; distanceKm: number | null; inRange: boolean }

/**
 * Delivery fee for one truck from a store to a site:
 * base + per-km × (straight-line km × road factor), never below the minimum, rounded up to ₦100.
 * Without both locations the distance is unknown and the minimum fee applies.
 */
export function quoteDelivery(rates: DeliveryRates, from: MaybeCoords, to: MaybeCoords): DeliveryQuote {
  if (!hasCoords(from) || !hasCoords(to)) return { fee: rates.deliveryMinFee, distanceKm: null, inRange: true }
  const distanceKm = Math.round(haversineKm(from, to) * rates.roadFactor * 10) / 10
  const fee = Math.max(rates.deliveryMinFee, Math.ceil((rates.deliveryBaseFee + rates.deliveryPerKm * distanceKm) / 100) * 100)
  return { fee, distanceKm, inRange: distanceKm <= rates.maxDeliveryKm }
}

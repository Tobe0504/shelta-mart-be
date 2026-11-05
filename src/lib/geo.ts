import { z } from "zod"

export type Coords = { lat: number; lng: number }
/** Coordinates as stored in Mongo, possibly missing. */
export type MaybeCoords = { lat?: number | null; lng?: number | null } | null | undefined

/** Nigeria's bounding box (min lng, min lat, max lng, max lat). Searches and coordinates are limited to it. */
export const NIGERIA_BBOX = [2.67, 4.27, 14.68, 13.89] as const

export const coordsSchema = z.object({
  lat: z.number().min(NIGERIA_BBOX[1]).max(NIGERIA_BBOX[3]),
  lng: z.number().min(NIGERIA_BBOX[0]).max(NIGERIA_BBOX[2]),
})

/** Mongoose shape for an optional lat/lng pair. */
export const coordsField = { _id: false, lat: Number, lng: Number }

const rad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coords, b: Coords) {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export const hasCoords = (c: MaybeCoords): c is Coords => typeof c?.lat === "number" && typeof c?.lng === "number"

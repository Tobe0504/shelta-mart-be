import { unavailable } from "../../lib/errors.ts"
import { NIGERIA_BBOX, type Coords } from "../../lib/geo.ts"
import { logger } from "../../lib/logger.ts"
import type { SearchInput } from "./geo.schema.ts"

/**
 * Address search and reverse geocoding via Photon (OpenStreetMap data, free, no key).
 * Calls go through this server so we can set a User-Agent, limit results to Nigeria and cache them.
 */
const BASE = "https://photon.komoot.io"
const USER_AGENT = "SheltaMart/0.1 (sheltamart.com)"
const TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHE = 1000

export type Place = {
  /** One-line label, e.g. "Allen Avenue, Oregun, Ikeja". */
  label: string
  /** Area and city for display, e.g. "Oregun, Ikeja". */
  area: string
  state?: string
  coords: Coords
}

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; county?: string; state?: string; country?: string }
}

const cache = new Map<string, { at: number; value: Place[] }>()

async function cached(key: string, load: () => Promise<Place[]>) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = await load()
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!)
  cache.set(key, { at: Date.now(), value })
  return value
}

const unique = (parts: (string | undefined)[]) => [...new Set(parts.filter((p): p is string => !!p?.trim()))]

function toPlace({ geometry, properties: p }: Feature): Place {
  const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street
  const area = unique([p.district ?? p.locality, p.city ?? p.county]).join(", ")
  return {
    label: unique([p.name, street, p.district ?? p.locality, p.city ?? p.county]).join(", "),
    area: area || p.state || "Nigeria",
    state: p.state,
    coords: { lat: geometry.coordinates[1], lng: geometry.coordinates[0] },
  }
}

async function photon(path: string) {
  const res = await fetch(BASE + path, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }).catch((err) => {
    logger.warn({ err }, "Photon unreachable")
    return null
  })
  if (!res?.ok) throw unavailable("Address search is unavailable right now. Try again in a moment.")
  const json = (await res.json()) as { features: Feature[] }
  const places = json.features.filter((f) => !f.properties.country || f.properties.country === "Nigeria").map(toPlace)
  // OpenStreetMap splits long roads into several pieces with the same name; keep the first of each.
  return places.filter((p, i) => places.findIndex((x) => x.label === p.label) === i)
}

export function search({ q, lat, lng }: SearchInput) {
  const near = lat !== undefined && lng !== undefined ? `&lat=${lat}&lon=${lng}` : ""
  const path = `/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${NIGERIA_BBOX.join(",")}${near}`
  return cached(path.toLowerCase(), () => photon(path))
}

export async function reverse({ lat, lng }: Coords) {
  const path = `/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&lang=en`
  const [place] = await cached(path, () => photon(path))
  // Keep the exact point the user chose, with the nearest named place as its label.
  return place ? { ...place, coords: { lat, lng } } : { label: "Pinned location", area: "Nigeria", coords: { lat, lng } }
}

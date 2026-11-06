import { z } from "zod"
import { coordsSchema } from "../../lib/geo.ts"
import { naira, pagination, phone, slug, text } from "../../lib/validation.ts"
import { proKinds, rateUnits } from "./pro.model.ts"

export const proProfileSchema = z.object({
  name: text(80),
  kind: z.enum(proKinds),
  headline: text(120),
  trades: z.array(slug).min(1, "Choose at least one trade").max(5),
  about: z.string().trim().max(2000).optional(),
  location: text(120),
  coords: coordsSchema,
  radiusKm: z.number().int().min(1).max(500),
  rate: z.object({ amount: naira, unit: z.enum(rateUnits) }).nullable().optional(),
  years: z.number().int().min(0).max(70).optional(),
  photo: z.url().nullable().optional(),
  portfolio: z.array(z.url()).max(12),
  phone,
})

export const proSorts = ["best", "rating", "jobs", "nearest"] as const

export const listProsSchema = pagination.extend({
  trade: slug.optional(),
  q: z.string().trim().max(80).optional(),
  verified: z.enum(["1"]).transform(() => true).optional(),
  sort: z.enum(proSorts).default("best"),
  /** When both are given, only pros who cover this point are listed, nearest first among equals. */
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
})

const flag = z.enum(["true", "false"]).transform((v) => v === "true")
export const adminListProsSchema = pagination.extend({ verified: flag.optional(), q: z.string().trim().max(80).optional() })
export const adminUpdateProSchema = z.object({ verified: z.boolean(), active: z.boolean() }).partial()

export type ProProfileInput = z.infer<typeof proProfileSchema>
export type ListProsInput = z.infer<typeof listProsSchema>
export type AdminListProsInput = z.infer<typeof adminListProsSchema>
export type AdminUpdateProInput = z.infer<typeof adminUpdateProSchema>

import { z } from "zod"
import { slug, text } from "../../lib/validation.ts"
import { supportStatuses } from "./conversation.model.ts"

/** Who to talk to, and optionally what about. One of `store`, `pro` or `support` is required. */
export const startSchema = z
  .object({
    /** Store slug or id (orders only know the id). */
    store: z.string().trim().min(1).max(80).optional(),
    pro: slug.optional(),
    support: z.literal(true).optional(),
    subject: text(120).optional(),
    about: z.object({ label: text(160), href: z.string().trim().startsWith("/").max(200) }).optional(),
    body: text(4000),
  })
  .refine((s) => [s.store, s.pro, s.support].filter(Boolean).length === 1, { message: "Choose who to message", path: ["store"] })

export const sendSchema = z.object({ body: text(4000) })
export const listSchema = z.object({ scope: z.enum(["mine", "support"]).default("mine"), status: z.enum(supportStatuses).optional() })
export const statusSchema = z.object({ status: z.enum(supportStatuses) })

export type StartInput = z.infer<typeof startSchema>
export type ListInput = z.infer<typeof listSchema>

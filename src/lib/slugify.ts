import { randomBytes } from "node:crypto"

export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

/** Slug with a short random suffix, for user-created records that must stay unique. */
export const uniqueSlug = (value: string) => `${slugify(value)}-${randomBytes(3).toString("hex")}`

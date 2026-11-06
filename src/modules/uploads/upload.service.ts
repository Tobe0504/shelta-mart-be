import { v2 as cloudinary } from "cloudinary"
import { env } from "../../config/env.ts"
import { forbidden, unauthorized, unavailable } from "../../lib/errors.ts"
import type { AuthUser } from "../../lib/tokens.ts"

const configured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
if (configured) cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true })

/** Who may upload each kind of file, and what's accepted. */
const kinds = {
  avatar: { who: "user", formats: "jpg,jpeg,png,webp", maxBytes: 2_000_000 },
  product: { who: "seller", formats: "jpg,jpeg,png,webp", maxBytes: 5_000_000 },
  estate: { who: "admin", formats: "jpg,jpeg,png,webp", maxBytes: 5_000_000 },
  quote: { who: "anyone", formats: "pdf,xls,xlsx,csv,jpg,jpeg,png", maxBytes: 20_000_000 },
  /** Pro profile photo and portfolio. */
  pro: { who: "user", formats: "jpg,jpeg,png,webp", maxBytes: 5_000_000 },
  /** Photos of the work a buyer wants done. */
  job: { who: "user", formats: "jpg,jpeg,png,webp", maxBytes: 5_000_000 },
} as const
export type UploadKind = keyof typeof kinds
export const uploadKinds = Object.keys(kinds) as [UploadKind, ...UploadKind[]]

/**
 * Signed parameters for uploading straight from the browser to Cloudinary,
 * so files never pass through this server.
 */
export function signUpload(kind: UploadKind, user?: AuthUser) {
  if (!configured) throw unavailable("File uploads aren’t set up yet")
  const rule = kinds[kind]
  if (rule.who !== "anyone" && !user) throw unauthorized()
  if ((rule.who === "seller" && user?.role === "buyer") || (rule.who === "admin" && user?.role !== "admin")) throw forbidden()

  const params = { timestamp: Math.round(Date.now() / 1000), folder: `sheltamart/${kind}`, allowed_formats: rule.formats }
  return {
    ...params,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    signature: cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!),
    maxBytes: rule.maxBytes,
  }
}

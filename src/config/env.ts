import { z } from "zod"

try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the real environment.
}

const optional = z.string().trim().optional().transform((v) => v || undefined)

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.url().default("http://localhost:3001"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/sheltamart"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: optional,
  PAYSTACK_SECRET_KEY: optional,
  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error("Invalid environment:\n" + z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === "production"

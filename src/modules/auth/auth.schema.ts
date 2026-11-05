import { z } from "zod"
import { phone, text } from "../../lib/validation.ts"

const email = z.email().trim().toLowerCase()
const password = z.string().min(8, "Use at least 8 characters").max(128)

export const registerSchema = z
  .object({
    name: text(80),
    email,
    phone,
    password,
    role: z.enum(["buyer", "seller"]).default("buyer"),
    business: text(120).optional(),
  })
  .refine((v) => v.role !== "seller" || v.business, { path: ["business"], message: "Enter your business name" })

export const loginSchema = z.object({ email, password: z.string().min(1) })
export const forgotPasswordSchema = z.object({ email })
export const resetPasswordSchema = z.object({ token: z.string().min(32), password })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

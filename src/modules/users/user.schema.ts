import { z } from "zod"
import { phone, text } from "../../lib/validation.ts"

export const updateProfileSchema = z
  .object({
    name: text(80),
    phone,
    avatar: z.url().nullable(),
    notify: z.object({ whatsapp: z.boolean(), email: z.boolean() }).partial(),
  })
  .partial()

export const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "Use at least 8 characters").max(128),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "node:crypto"
import { env } from "../../config/env.ts"
import { badRequest, conflict, unauthorized } from "../../lib/errors.ts"
import { sendMail } from "../../lib/mailer.ts"
import { createStoreFor } from "../stores/store.service.ts"
import { UserModel } from "../users/user.model.ts"
import type { LoginInput, RegisterInput, ResetPasswordInput } from "./auth.schema.ts"

const RESET_TTL_MS = 60 * 60 * 1000
/** Compared against when the email is unknown, so response time doesn't reveal which accounts exist. */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12)
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

/** What the token helpers need to issue cookies for a user. */
const subject = (user: { id: string; role: string; tokenVersion?: number }) => ({
  id: user.id,
  role: user.role as "buyer" | "seller" | "admin",
  tokenVersion: user.tokenVersion ?? 0,
})

export async function register({ password, business, ...input }: RegisterInput) {
  if (await UserModel.exists({ email: input.email })) throw conflict("An account with this email already exists")
  const user = await UserModel.create({ ...input, passwordHash: await bcrypt.hash(password, 12) })
  if (input.role === "seller" && business) await createStoreFor(user.id, business)
  return { user, subject: subject(user) }
}

export async function login({ email, password }: LoginInput) {
  const user = await UserModel.findOne({ email }).select("+passwordHash +tokenVersion")
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) throw unauthorized("Email or password is incorrect")
  return { user, subject: subject(user) }
}

/** Validates a refresh token's version and returns the user to issue fresh cookies for. */
export async function refresh(id: string, version: number) {
  const user = await UserModel.findById(id).select("+tokenVersion")
  if (!user || user.tokenVersion !== version) throw unauthorized("Your session has ended. Sign in again.")
  return subject(user)
}

export async function logout(id: string) {
  await UserModel.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } })
}

export async function forgotPassword(email: string) {
  const user = await UserModel.findOne({ email })
  if (!user) return // Same response either way, so emails can't be probed.
  const token = randomBytes(32).toString("hex")
  await UserModel.updateOne({ _id: user.id }, { resetTokenHash: hashToken(token), resetExpires: new Date(Date.now() + RESET_TTL_MS) })
  await sendMail({
    to: user.email,
    subject: "Reset your SheltaMart password",
    text: `Use this link within an hour to choose a new password: ${env.CLIENT_URL}/reset-password?token=${token}`,
  })
}

export async function resetPassword({ token, password }: ResetPasswordInput) {
  const user = await UserModel.findOne({ resetTokenHash: hashToken(token), resetExpires: { $gt: new Date() } }).select("+tokenVersion")
  if (!user) throw badRequest("This reset link is invalid or has expired")
  user.set({ passwordHash: await bcrypt.hash(password, 12), resetTokenHash: undefined, resetExpires: undefined, tokenVersion: user.tokenVersion + 1 })
  await user.save()
}

import type { Request, Response } from "express"
import { unauthorized } from "../../lib/errors.ts"
import { clearAuthCookies, cookieNames, setAuthCookies, verifyRefresh } from "../../lib/tokens.ts"
import { currentUser } from "../../middleware/auth.ts"
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth.schema.ts"
import * as auth from "./auth.service.ts"

export async function register(req: Request, res: Response) {
  const { user, subject } = await auth.register(registerSchema.parse(req.body))
  setAuthCookies(res, subject)
  res.status(201).json({ data: user })
}

export async function login(req: Request, res: Response) {
  const { user, subject } = await auth.login(loginSchema.parse(req.body))
  setAuthCookies(res, subject)
  res.json({ data: user })
}

export async function refresh(req: Request, res: Response) {
  const token = verifyRefresh(req.cookies?.[cookieNames.refresh] ?? "")
  if (!token) {
    clearAuthCookies(res)
    throw unauthorized("Your session has ended. Sign in again.")
  }
  setAuthCookies(res, await auth.refresh(token.id, token.ver))
  res.status(204).end()
}

export async function logout(req: Request, res: Response) {
  await auth.logout(currentUser(req).id)
  clearAuthCookies(res)
  res.status(204).end()
}

export async function forgotPassword(req: Request, res: Response) {
  await auth.forgotPassword(forgotPasswordSchema.parse(req.body).email)
  res.status(202).json({ data: { message: "If that email has an account, we’ve sent a reset link." } })
}

export async function resetPassword(req: Request, res: Response) {
  await auth.resetPassword(resetPasswordSchema.parse(req.body))
  res.status(204).end()
}

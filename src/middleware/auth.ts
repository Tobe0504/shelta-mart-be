import type { NextFunction, Request, Response } from "express"
import { forbidden, unauthorized } from "../lib/errors.ts"
import { cookieNames, verifyAccess, type AuthUser, type Role } from "../lib/tokens.ts"

/** Reads the access token (cookie, or `Authorization: Bearer`) and sets `req.user`. Never rejects. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  const token = req.cookies?.[cookieNames.access] ?? bearer
  if (token) req.user = verifyAccess(token) ?? undefined
  next()
}

/** Rejects unless signed in, and (when given) one of `allowed` roles. Admins pass every role check. */
export const requireAuth =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized()
    if (allowed.length && req.user.role !== "admin" && !allowed.includes(req.user.role)) throw forbidden()
    next()
  }

/** The signed-in user. Use only behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized()
  return req.user
}

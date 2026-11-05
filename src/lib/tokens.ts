import type { CookieOptions, Response } from "express"
import jwt from "jsonwebtoken"
import { env, isProd } from "../config/env.ts"

export const roles = ["buyer", "seller", "admin"] as const
export type Role = (typeof roles)[number]
export type AuthUser = { id: string; role: Role }

const ACCESS_TTL = 15 * 60
const REFRESH_TTL = 30 * 24 * 60 * 60
/** `session` is readable by the frontend: it only says "a session exists" so signed-out pages skip auth calls. */
export const cookieNames = { access: "sm_access", refresh: "sm_refresh", session: "sm_session" } as const

const cookie = (maxAgeSeconds: number, path = "/"): CookieOptions => ({
  httpOnly: true,
  secure: isProd || env.COOKIE_SAME_SITE === "none",
  sameSite: env.COOKIE_SAME_SITE,
  domain: env.COOKIE_DOMAIN,
  path,
  maxAge: maxAgeSeconds * 1000,
})
// The refresh cookie is only sent to the auth routes.
const REFRESH_PATH = "/api/v1/auth"

type Subject = { id: string; role: Role; tokenVersion: number }

export function setAuthCookies(res: Response, user: Subject) {
  const access = jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: ACCESS_TTL })
  const refresh = jwt.sign({ ver: user.tokenVersion }, env.JWT_REFRESH_SECRET, { subject: user.id, expiresIn: REFRESH_TTL })
  res.cookie(cookieNames.access, access, cookie(ACCESS_TTL))
  res.cookie(cookieNames.refresh, refresh, cookie(REFRESH_TTL, REFRESH_PATH))
  res.cookie(cookieNames.session, "1", { ...cookie(REFRESH_TTL), httpOnly: false })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(cookieNames.access, { ...cookie(0), maxAge: undefined })
  res.clearCookie(cookieNames.refresh, { ...cookie(0, REFRESH_PATH), maxAge: undefined })
  res.clearCookie(cookieNames.session, { ...cookie(0), httpOnly: false, maxAge: undefined })
}

export function verifyAccess(token: string): AuthUser | null {
  try {
    const { sub, role } = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    return sub && roles.includes(role) ? { id: sub, role } : null
  } catch {
    return null
  }
}

export function verifyRefresh(token: string): { id: string; ver: number } | null {
  try {
    const { sub, ver } = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload
    return sub && typeof ver === "number" ? { id: sub, ver } : null
  } catch {
    return null
  }
}

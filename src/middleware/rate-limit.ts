import { rateLimit } from "express-rate-limit"

const limiter = (limit: number, minutes: number) =>
  rateLimit({
    windowMs: minutes * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "Too many requests. Try again in a few minutes." } },
  })

export const authLimiter = limiter(20, 15)
export const formLimiter = limiter(10, 15)
/** Address lookups: generous for type-as-you-search, but protects the free upstream service. */
export const geoLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "rate_limited", message: "Slow down a little and try again." } } })

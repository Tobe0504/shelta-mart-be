import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import { authLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./auth.controller.ts"

export const authRoutes = Router()
  .use("/auth", authLimiter)
  .post("/auth/register", c.register)
  .post("/auth/login", c.login)
  .post("/auth/refresh", c.refresh)
  .post("/auth/logout", requireAuth(), c.logout)
  .post("/auth/forgot-password", c.forgotPassword)
  .post("/auth/reset-password", c.resetPassword)

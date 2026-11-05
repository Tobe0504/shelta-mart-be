import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./payment.controller.ts"

export const paymentRoutes = Router().post("/payments/paystack/webhook", c.webhook).get("/payments/verify", requireAuth(), c.verify)

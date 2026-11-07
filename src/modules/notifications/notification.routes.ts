import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./notification.controller.ts"

const signedIn = requireAuth()

export const notificationRoutes = Router()
  .get("/notifications", signedIn, c.list)
  .post("/notifications/read", signedIn, c.markRead)
  .post("/realtime/ticket", signedIn, c.ticket)

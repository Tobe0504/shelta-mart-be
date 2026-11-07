import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import { formLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./conversation.controller.ts"

const signedIn = requireAuth()

export const conversationRoutes = Router()
  .get("/conversations", signedIn, c.list)
  .get("/conversations/unread", signedIn, c.unread)
  .post("/conversations", signedIn, formLimiter, c.start)
  .get("/conversations/:id", signedIn, c.messages)
  .post("/conversations/:id/messages", signedIn, c.send)
  .patch("/conversations/:id", signedIn, c.setStatus)

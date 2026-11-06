import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import { formLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./quote.controller.ts"

const admin = requireAuth("admin")

export const quoteRoutes = Router()
  .post("/quotes", formLimiter, c.create)
  .get("/quotes", requireAuth(), c.listMine)
  .get("/admin/quotes", admin, c.listAll)
  .get("/admin/quotes/:id", admin, c.get)
  .patch("/admin/quotes/:id", admin, c.update)

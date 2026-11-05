import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./promo.controller.ts"

const admin = requireAuth("admin")

export const promoRoutes = Router()
  .get("/promos", c.list)
  .get("/admin/promos", admin, c.listAll)
  .post("/admin/promos", admin, c.create)
  .patch("/admin/promos/:id", admin, c.update)
  .delete("/admin/promos/:id", admin, c.remove)

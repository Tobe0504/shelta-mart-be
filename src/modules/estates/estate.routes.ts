import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./estate.controller.ts"

const admin = requireAuth("admin")

export const estateRoutes = Router()
  .get("/estates", c.list)
  .get("/estates/:slug", c.get)
  .get("/admin/estates", admin, c.listAll)
  .post("/admin/estates", admin, c.create)
  .delete("/admin/estates/:slug", admin, c.remove)
  .patch("/admin/estates/:slug", admin, c.update)

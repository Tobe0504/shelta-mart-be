import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./setting.controller.ts"

export const settingRoutes = Router()
  .get("/settings", c.getPublic)
  .get("/admin/settings", requireAuth("admin"), c.getAll)
  .patch("/admin/settings", requireAuth("admin"), c.update)

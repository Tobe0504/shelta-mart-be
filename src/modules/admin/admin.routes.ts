import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./admin.controller.ts"

export const adminRoutes = Router().use("/admin", requireAuth("admin")).get("/admin/overview", c.overview).get("/admin/stores", c.stores)

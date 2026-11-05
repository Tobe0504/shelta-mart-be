import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./area.controller.ts"

const admin = requireAuth("admin")

export const areaRoutes = Router().get("/areas", c.list).get("/admin/areas", admin, c.listAll).put("/admin/areas", admin, c.upsert)

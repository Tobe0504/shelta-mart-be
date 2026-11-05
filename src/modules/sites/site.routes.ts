import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./site.controller.ts"

export const siteRoutes = Router()
  .use("/sites", requireAuth())
  .get("/sites", c.list)
  .post("/sites", c.create)
  .patch("/sites/:id", c.update)
  .delete("/sites/:id", c.remove)

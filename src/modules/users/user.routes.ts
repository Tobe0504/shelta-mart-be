import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./user.controller.ts"

export const userRoutes = Router()
  .use("/me", requireAuth())
  .get("/me", c.me)
  .patch("/me", c.updateMe)
  .put("/me/password", c.changePassword)
  .get("/me/saved", c.saved)
  .put("/me/saved/:productId", c.save)
  .delete("/me/saved/:productId", c.unsave)

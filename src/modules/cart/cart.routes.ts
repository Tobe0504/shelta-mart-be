import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./cart.controller.ts"

export const cartRoutes = Router()
  .use("/cart", requireAuth())
  .get("/cart", c.get)
  .put("/cart/lines/:productId", c.setLine)
  .post("/cart/merge", c.merge)
  .delete("/cart", c.clear)

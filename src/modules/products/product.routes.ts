import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./product.controller.ts"

const seller = requireAuth("seller")

export const productRoutes = Router()
  .get("/products", c.search)
  .get("/products/brands", c.brands)
  .get("/products/:slug", c.get)
  .get("/products/:slug/related", c.related)
  .get("/seller/products", seller, c.listOwn)
  .post("/seller/products", seller, c.create)
  .get("/seller/products/:slug", seller, c.getOwn)
  .patch("/seller/products/:slug", seller, c.update)
  .delete("/seller/products/:slug", seller, c.remove)

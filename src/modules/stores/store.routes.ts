import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./store.controller.ts"

const seller = requireAuth("seller")

export const storeRoutes = Router()
  .get("/stores/:slug", c.getPublic)
  .get("/seller/store", seller, c.getMine)
  .patch("/seller/store", seller, c.updateMine)
  .put("/seller/store/payout", seller, c.setPayout)
  .get("/seller/banks", seller, c.banks)
  .post("/seller/banks/resolve", seller, c.resolveAccount)
  .patch("/admin/stores/:id/verification", requireAuth("admin"), c.verify)

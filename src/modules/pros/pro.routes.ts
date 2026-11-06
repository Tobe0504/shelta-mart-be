import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./pro.controller.ts"

/** Any signed-in account can offer services; being a pro is a profile, not a role. */
const signedIn = requireAuth()
const admin = requireAuth("admin")

export const proRoutes = Router()
  .get("/pros", c.list)
  .get("/pros/trade-counts", c.counts)
  .get("/pros/:slug", c.get)
  .get("/pro/profile", signedIn, c.getMine)
  .put("/pro/profile", signedIn, c.saveMine)
  .put("/pro/payout", signedIn, c.setPayout)
  .get("/pro/banks", signedIn, c.banks)
  .post("/pro/banks/resolve", signedIn, c.resolveAccount)
  .get("/admin/pros", admin, c.listAll)
  .patch("/admin/pros/:id", admin, c.update)

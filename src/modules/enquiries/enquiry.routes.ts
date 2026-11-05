import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import { formLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./enquiry.controller.ts"

const seller = requireAuth("seller")
const admin = requireAuth("admin")

export const enquiryRoutes = Router()
  .post("/enquiries", formLimiter, c.create)
  .get("/seller/enquiries", seller, c.listForSeller)
  .patch("/seller/enquiries/:id", seller, c.updateForSeller)
  .get("/admin/enquiries", admin, c.listAll)
  .patch("/admin/enquiries/:id", admin, c.update)

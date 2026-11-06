import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import { formLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./job.controller.ts"

const signedIn = requireAuth()
const admin = requireAuth("admin")

export const jobRoutes = Router()
  .post("/jobs", signedIn, formLimiter, c.create)
  .get("/jobs", signedIn, c.listMine)
  // Before /jobs/:id, which would otherwise match "payments".
  .get("/jobs/payments/verify", signedIn, c.verifyPayment)
  .get("/jobs/:id", signedIn, c.getMine)
  .post("/jobs/:id/hire", signedIn, c.hire)
  .post("/jobs/:id/stages/:stage/pay", signedIn, c.payStage)
  .post("/jobs/:id/stages/:stage/release", signedIn, c.releaseStage)
  .post("/jobs/:id/stages/:stage/report", signedIn, formLimiter, c.reportStage)
  .post("/jobs/:id/cancel", signedIn, c.cancel)
  .post("/jobs/:id/review", signedIn, c.review)
  .get("/pro/leads", signedIn, c.leads)
  .get("/pro/jobs", signedIn, c.proJobs)
  .get("/pro/jobs/:id", signedIn, c.getForPro)
  .post("/pro/leads/:id/bids", signedIn, formLimiter, c.bid)
  .get("/admin/jobs", admin, c.listAll)
  .get("/admin/escrow", admin, c.listEscrow)
  .post("/admin/jobs/:id/stages/:stage/release", admin, c.adminRelease)
  .post("/admin/jobs/:id/stages/:stage/refund", admin, c.adminRefund)

import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./order.controller.ts"

const buyer = requireAuth()
const seller = requireAuth("seller")
const shipment = "/orders/:number/shipments/:shipmentId"

export const orderRoutes = Router()
  .post("/orders", buyer, c.create)
  .get("/orders", buyer, c.listMine)
  .get("/orders/:number", buyer, c.getMine)
  .post("/orders/:number/payment", buyer, c.retryPayment)
  .post(`${shipment}/confirm`, buyer, c.confirm)
  .get(`${shipment}/slots`, buyer, c.slots)
  .post(`${shipment}/reschedule`, buyer, c.reschedule)
  .post(`${shipment}/report`, buyer, c.report)
  .get("/seller/orders", seller, c.listForSeller)
  .post(`/seller${shipment}/accept`, seller, c.accept)
  .post(`/seller${shipment}/load`, seller, c.load)
  .post(`/seller${shipment}/dispatch`, seller, c.dispatch)
  .post(`/seller${shipment}/decline`, seller, c.decline)
  .post("/admin/payouts/run", requireAuth("admin"), c.runPayouts)
  .get("/admin/escrow/orders", requireAuth("admin"), c.listEscrow)
  .post(`/admin${shipment}/release`, requireAuth("admin"), c.adminRelease)
  .post(`/admin${shipment}/refund`, requireAuth("admin"), c.adminRefund)

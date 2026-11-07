import { processDueJobPayouts } from "../jobs/job.escrow.ts"
import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { createOrderSchema, declineSchema, dispatchSchema, listOrdersSchema, orderNumber, reportSchema, rescheduleSchema } from "./order.schema.ts"
import * as orders from "./order.service.ts"

/** `:number` and `:shipmentId` from the URL, validated. */
const target = (req: Request) => [currentUser(req).id, orderNumber.parse(req.params.number), objectId.parse(req.params.shipmentId)] as const

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await orders.createOrder(currentUser(req).id, createOrderSchema.parse(req.body)) })
}

export async function listMine(req: Request, res: Response) {
  res.json(await orders.listForBuyer(currentUser(req).id, listOrdersSchema.parse(req.query)))
}

export async function getMine(req: Request, res: Response) {
  res.json({ data: await orders.getForBuyer(currentUser(req).id, orderNumber.parse(req.params.number)) })
}

export async function retryPayment(req: Request, res: Response) {
  res.json({ data: await orders.retryPayment(currentUser(req).id, orderNumber.parse(req.params.number)) })
}

export async function confirm(req: Request, res: Response) {
  res.json({ data: await orders.confirmDelivery(...target(req)) })
}

export async function slots(req: Request, res: Response) {
  res.json({ data: await orders.slotsFor(...target(req)) })
}

export async function reschedule(req: Request, res: Response) {
  res.json({ data: await orders.reschedule(...target(req), rescheduleSchema.parse(req.body).slot) })
}

export async function report(req: Request, res: Response) {
  res.json({ data: await orders.reportIssue(...target(req), reportSchema.parse(req.body)) })
}

export async function listForSeller(req: Request, res: Response) {
  res.json(await orders.listForSeller(currentUser(req).id, listOrdersSchema.parse(req.query)))
}

export async function accept(req: Request, res: Response) {
  res.json({ data: await orders.accept(...target(req)) })
}

export async function load(req: Request, res: Response) {
  res.json({ data: await orders.markLoaded(...target(req)) })
}

export async function dispatch(req: Request, res: Response) {
  res.json({ data: await orders.dispatch(...target(req), dispatchSchema.parse(req.body)) })
}

export async function decline(req: Request, res: Response) {
  res.json({ data: await orders.decline(...target(req), declineSchema.parse(req.body).reason) })
}

export async function runPayouts(_req: Request, res: Response) {
  const [goods, jobs] = await Promise.all([orders.processDuePayouts(), processDueJobPayouts()])
  res.json({ data: { paid: goods.paid + jobs.paid } })
}

export async function listEscrow(_req: Request, res: Response) {
  res.json({ data: await orders.listEscrowOrders() })
}

const adminTarget = (req: Request) => [orderNumber.parse(req.params.number), objectId.parse(req.params.shipmentId)] as const

export async function adminRelease(req: Request, res: Response) {
  res.json({ data: await orders.adminRelease(...adminTarget(req)) })
}

export async function adminRefund(req: Request, res: Response) {
  res.json({ data: await orders.adminRefund(...adminTarget(req)) })
}

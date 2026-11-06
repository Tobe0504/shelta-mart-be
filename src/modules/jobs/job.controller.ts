import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { z } from "zod"
import * as escrow from "./job.escrow.ts"
import { bidSchema, createJobSchema, hireSchema, listJobsSchema, reportSchema, reviewSchema } from "./job.schema.ts"
import * as jobs from "./job.service.ts"

const id = (req: Request) => objectId.parse(req.params.id)

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await jobs.createJob(currentUser(req).id, createJobSchema.parse(req.body)) })
}

export async function listMine(req: Request, res: Response) {
  res.json(await jobs.listMine(currentUser(req).id, listJobsSchema.parse(req.query)))
}

export async function getMine(req: Request, res: Response) {
  res.json({ data: await jobs.getMine(currentUser(req).id, id(req)) })
}

export async function getForPro(req: Request, res: Response) {
  res.json({ data: await jobs.getForPro(currentUser(req).id, id(req)) })
}

export async function hire(req: Request, res: Response) {
  res.json({ data: await jobs.hire(currentUser(req).id, id(req), hireSchema.parse(req.body).bid) })
}

export async function cancel(req: Request, res: Response) {
  res.json({ data: await jobs.cancel(currentUser(req).id, id(req)) })
}

export async function review(req: Request, res: Response) {
  res.json({ data: await jobs.review(currentUser(req).id, id(req), reviewSchema.parse(req.body)) })
}

export async function leads(req: Request, res: Response) {
  res.json({ data: await jobs.listLeads(currentUser(req).id) })
}

export async function proJobs(req: Request, res: Response) {
  res.json({ data: await jobs.listProJobs(currentUser(req).id) })
}

export async function bid(req: Request, res: Response) {
  res.status(201).json({ data: await jobs.placeBid(currentUser(req).id, id(req), bidSchema.parse(req.body)) })
}

export async function listAll(req: Request, res: Response) {
  res.json(await jobs.listAll(listJobsSchema.parse(req.query)))
}

// ——— Escrow ———

const stage = (req: Request) => objectId.parse(req.params.stage)

export async function payStage(req: Request, res: Response) {
  res.json({ data: await escrow.startStagePayment(currentUser(req).id, id(req), stage(req)) })
}

export async function verifyPayment(req: Request, res: Response) {
  const { reference } = z.object({ reference: z.string().min(1).max(120) }).parse(req.query)
  res.json({ data: await escrow.verifyStagePayment(currentUser(req).id, reference) })
}

export async function releaseStage(req: Request, res: Response) {
  res.json({ data: await escrow.releaseStage(currentUser(req).id, id(req), stage(req)) })
}

export async function reportStage(req: Request, res: Response) {
  res.json({ data: await escrow.reportStage(currentUser(req).id, id(req), stage(req), reportSchema.parse(req.body).message) })
}

export async function listEscrow(_req: Request, res: Response) {
  res.json({ data: await escrow.listEscrow() })
}

export async function adminRelease(req: Request, res: Response) {
  res.json({ data: await escrow.adminRelease(id(req), stage(req)) })
}

export async function adminRefund(req: Request, res: Response) {
  res.json({ data: await escrow.adminRefund(id(req), stage(req)) })
}

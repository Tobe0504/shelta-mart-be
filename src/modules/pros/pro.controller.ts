import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId, slug } from "../../lib/validation.ts"
import { adminListProsSchema, adminUpdateProSchema, listProsSchema, proProfileSchema } from "./pro.schema.ts"
import * as paystack from "../../lib/paystack.ts"
import { payoutSchema, resolveAccountSchema } from "../stores/store.schema.ts"
import * as pros from "./pro.service.ts"

export async function list(req: Request, res: Response) {
  res.json(await pros.listPros(listProsSchema.parse(req.query)))
}

export async function counts(_req: Request, res: Response) {
  res.json({ data: await pros.tradeCounts() })
}

export async function get(req: Request, res: Response) {
  res.json({ data: await pros.getPublicPro(slug.parse(req.params.slug)) })
}

export async function getMine(req: Request, res: Response) {
  res.json({ data: await pros.getOwnPro(currentUser(req).id) })
}

export async function saveMine(req: Request, res: Response) {
  res.json({ data: await pros.saveOwnPro(currentUser(req).id, proProfileSchema.parse(req.body)) })
}

export async function listAll(req: Request, res: Response) {
  res.json(await pros.adminListPros(adminListProsSchema.parse(req.query)))
}

export async function update(req: Request, res: Response) {
  res.json({ data: await pros.adminUpdatePro(objectId.parse(req.params.id), adminUpdateProSchema.parse(req.body)) })
}

export async function setPayout(req: Request, res: Response) {
  res.json({ data: await pros.setOwnPayout(currentUser(req).id, payoutSchema.parse(req.body)) })
}

export async function banks(_req: Request, res: Response) {
  res.json({ data: await paystack.listBanks() })
}

export async function resolveAccount(req: Request, res: Response) {
  const { accountNumber, bankCode } = resolveAccountSchema.parse(req.body)
  res.json({ data: await paystack.resolveAccount(accountNumber, bankCode) })
}

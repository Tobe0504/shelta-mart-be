import type { Request, Response } from "express"
import { objectId } from "../../lib/validation.ts"
import { listPromosSchema, promoSchema, updatePromoSchema } from "./promo.schema.ts"
import * as promos from "./promo.service.ts"

export async function list(req: Request, res: Response) {
  res.json({ data: await promos.listRunning(listPromosSchema.parse(req.query).category) })
}

export async function listAll(_req: Request, res: Response) {
  res.json({ data: await promos.listAll() })
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await promos.createPromo(promoSchema.parse(req.body)) })
}

export async function update(req: Request, res: Response) {
  res.json({ data: await promos.updatePromo(objectId.parse(req.params.id), updatePromoSchema.parse(req.body)) })
}

export async function remove(req: Request, res: Response) {
  await promos.deletePromo(objectId.parse(req.params.id))
  res.status(204).end()
}

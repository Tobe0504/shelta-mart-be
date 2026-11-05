import type { Request, Response } from "express"
import { areaSchema } from "./area.schema.ts"
import * as areas from "./area.service.ts"

export async function list(_req: Request, res: Response) {
  res.json({ data: await areas.listAreas() })
}

export async function listAll(_req: Request, res: Response) {
  res.json({ data: await areas.listAllAreas() })
}

export async function upsert(req: Request, res: Response) {
  res.json({ data: await areas.upsertArea(areaSchema.parse(req.body)) })
}

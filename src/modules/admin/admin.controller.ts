import type { Request, Response } from "express"
import { listStoresSchema } from "./admin.schema.ts"
import * as admin from "./admin.service.ts"

export async function overview(_req: Request, res: Response) {
  res.json({ data: await admin.overview() })
}

export async function stores(req: Request, res: Response) {
  res.json(await admin.listStores(listStoresSchema.parse(req.query)))
}

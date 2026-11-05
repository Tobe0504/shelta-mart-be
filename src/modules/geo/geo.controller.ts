import type { Request, Response } from "express"
import { reverseSchema, searchSchema } from "./geo.schema.ts"
import * as geo from "./geo.service.ts"

export async function search(req: Request, res: Response) {
  res.json({ data: await geo.search(searchSchema.parse(req.query)) })
}

export async function reverse(req: Request, res: Response) {
  res.json({ data: await geo.reverse(reverseSchema.parse(req.query)) })
}

import type { Request, Response } from "express"
import { searchSchema } from "./search.schema.ts"
import { searchEverything } from "./search.service.ts"

export async function search(req: Request, res: Response) {
  res.json({ data: await searchEverything(searchSchema.parse(req.query)) })
}

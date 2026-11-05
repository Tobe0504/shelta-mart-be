import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { createQuoteSchema, listQuotesSchema, updateQuoteSchema } from "./quote.schema.ts"
import * as quotes from "./quote.service.ts"

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await quotes.createQuote(createQuoteSchema.parse(req.body), req.user?.id) })
}

export async function listMine(req: Request, res: Response) {
  res.json({ data: await quotes.listMine(currentUser(req).id) })
}

export async function listAll(req: Request, res: Response) {
  res.json(await quotes.listAll(listQuotesSchema.parse(req.query)))
}

export async function update(req: Request, res: Response) {
  res.json({ data: await quotes.updateQuote(objectId.parse(req.params.id), updateQuoteSchema.parse(req.body)) })
}

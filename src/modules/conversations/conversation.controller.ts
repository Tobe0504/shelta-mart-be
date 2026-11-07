import type { Request, Response } from "express"
import { objectId } from "../../lib/validation.ts"
import { currentUser } from "../../middleware/auth.ts"
import { listSchema, sendSchema, startSchema, statusSchema } from "./conversation.schema.ts"
import * as conversations from "./conversation.service.ts"

const id = (req: Request) => objectId.parse(req.params.id)

export async function list(req: Request, res: Response) {
  res.json({ data: await conversations.list(currentUser(req), listSchema.parse(req.query)) })
}

export async function unread(req: Request, res: Response) {
  res.json({ data: await conversations.unread(currentUser(req)) })
}

export async function start(req: Request, res: Response) {
  res.status(201).json({ data: await conversations.start(currentUser(req), startSchema.parse(req.body)) })
}

export async function messages(req: Request, res: Response) {
  res.json({ data: await conversations.messages(currentUser(req), id(req)) })
}

export async function send(req: Request, res: Response) {
  res.status(201).json({ data: await conversations.send(currentUser(req), id(req), sendSchema.parse(req.body).body) })
}

export async function setStatus(req: Request, res: Response) {
  res.json({ data: await conversations.setStatus(currentUser(req), id(req), statusSchema.parse(req.body).status) })
}

import type { Request, Response } from "express"
import { socketTicket } from "../../lib/realtime.ts"
import { currentUser } from "../../middleware/auth.ts"
import { markReadSchema } from "./notification.schema.ts"
import * as notifications from "./notification.service.ts"

export async function list(req: Request, res: Response) {
  res.json({ data: await notifications.listMine(currentUser(req).id) })
}

export async function markRead(req: Request, res: Response) {
  res.json({ data: await notifications.markRead(currentUser(req).id, markReadSchema.parse(req.body)) })
}

/** A 60-second ticket the browser uses to open its live connection. */
export function ticket(req: Request, res: Response) {
  res.json({ data: { token: socketTicket(currentUser(req)) } })
}

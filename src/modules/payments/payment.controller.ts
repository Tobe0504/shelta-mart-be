import type { Request, Response } from "express"
import { z } from "zod"
import { currentUser } from "../../middleware/auth.ts"
import * as payments from "./payment.service.ts"

export async function webhook(req: Request, res: Response) {
  const ok = await payments.handleWebhook(req.rawBody, req.header("x-paystack-signature"))
  res.sendStatus(ok ? 200 : 401)
}

export async function verify(req: Request, res: Response) {
  const { reference } = z.object({ reference: z.string().min(1).max(100) }).parse(req.query)
  res.json({ data: await payments.verify(currentUser(req).id, reference) })
}

import type { Request, Response } from "express"
import { z } from "zod"
import { currentUser } from "../../middleware/auth.ts"
import { objectId, slug } from "../../lib/validation.ts"
import { payoutSchema, resolveAccountSchema, updateStoreSchema } from "./store.schema.ts"
import * as stores from "./store.service.ts"

export async function getPublic(req: Request, res: Response) {
  res.json({ data: await stores.getPublicStore(slug.parse(req.params.slug)) })
}

export async function getMine(req: Request, res: Response) {
  res.json({ data: await stores.getOwnStore(currentUser(req).id) })
}

export async function updateMine(req: Request, res: Response) {
  res.json({ data: await stores.updateOwnStore(currentUser(req).id, updateStoreSchema.parse(req.body)) })
}

export async function setPayout(req: Request, res: Response) {
  res.json({ data: await stores.setPayout(currentUser(req).id, payoutSchema.parse(req.body)) })
}

export async function banks(_req: Request, res: Response) {
  res.json({ data: await stores.listBanks() })
}

export async function resolveAccount(req: Request, res: Response) {
  const { accountNumber, bankCode } = resolveAccountSchema.parse(req.body)
  res.json({ data: await stores.resolveAccount(accountNumber, bankCode) })
}

export async function verify(req: Request, res: Response) {
  const { verified } = z.object({ verified: z.boolean() }).parse(req.body)
  res.json({ data: await stores.setVerified(objectId.parse(req.params.id), verified) })
}

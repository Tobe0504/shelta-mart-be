import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { changePasswordSchema, updateProfileSchema } from "./user.schema.ts"
import * as users from "./user.service.ts"

export async function me(req: Request, res: Response) {
  res.json({ data: await users.getProfile(currentUser(req).id) })
}

export async function updateMe(req: Request, res: Response) {
  res.json({ data: await users.updateProfile(currentUser(req).id, updateProfileSchema.parse(req.body)) })
}

export async function changePassword(req: Request, res: Response) {
  await users.changePassword(currentUser(req).id, changePasswordSchema.parse(req.body))
  res.status(204).end()
}

export async function saved(req: Request, res: Response) {
  res.json({ data: await users.listSaved(currentUser(req).id) })
}

export async function save(req: Request, res: Response) {
  res.json({ data: await users.setSaved(currentUser(req).id, objectId.parse(req.params.productId), true) })
}

export async function unsave(req: Request, res: Response) {
  res.json({ data: await users.setSaved(currentUser(req).id, objectId.parse(req.params.productId), false) })
}

import type { Request, Response } from "express"
import { updateSettingsSchema } from "./setting.schema.ts"
import * as settings from "./setting.service.ts"

export async function getPublic(_req: Request, res: Response) {
  res.json({ data: await settings.publicSettings() })
}

export async function getAll(_req: Request, res: Response) {
  res.json({ data: await settings.getSettings() })
}

export async function update(req: Request, res: Response) {
  res.json({ data: await settings.updateSettings(updateSettingsSchema.parse(req.body)) })
}

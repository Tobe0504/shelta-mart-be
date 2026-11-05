import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { siteSchema, updateSiteSchema } from "./site.schema.ts"
import * as sites from "./site.service.ts"

export async function list(req: Request, res: Response) {
  res.json({ data: await sites.listSites(currentUser(req).id) })
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await sites.createSite(currentUser(req).id, siteSchema.parse(req.body)) })
}

export async function update(req: Request, res: Response) {
  res.json({ data: await sites.updateSite(currentUser(req).id, objectId.parse(req.params.id), updateSiteSchema.parse(req.body)) })
}

export async function remove(req: Request, res: Response) {
  await sites.deleteSite(currentUser(req).id, objectId.parse(req.params.id))
  res.status(204).end()
}

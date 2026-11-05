import { notFound } from "../../lib/errors.ts"
import { SiteModel } from "./site.model.ts"
import type { SiteInput, UpdateSiteInput } from "./site.schema.ts"

export const listSites = (user: string) => SiteModel.find({ user }).sort({ updatedAt: -1 })

export async function getSite(user: string, id: string) {
  const site = await SiteModel.findOne({ _id: id, user })
  if (!site) throw notFound("Site")
  return site
}

export const createSite = (user: string, input: SiteInput) => SiteModel.create({ ...input, user })

export async function updateSite(user: string, id: string, input: UpdateSiteInput) {
  const site = await getSite(user, id)
  site.set(input)
  return site.save()
}

export async function deleteSite(user: string, id: string) {
  const { deletedCount } = await SiteModel.deleteOne({ _id: id, user })
  if (!deletedCount) throw notFound("Site")
}

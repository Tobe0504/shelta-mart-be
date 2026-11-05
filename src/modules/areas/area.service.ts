import { badRequest } from "../../lib/errors.ts"
import { AreaModel } from "./area.model.ts"
import type { AreaInput } from "./area.schema.ts"

export const listAreas = () => AreaModel.find({ active: true }).sort({ city: 1, name: 1 })

export const listAllAreas = () => AreaModel.find().sort({ city: 1, name: 1 })

export async function getActiveArea(slug: string) {
  const area = await AreaModel.findOne({ slug, active: true })
  if (!area) throw badRequest("We don’t deliver to that area yet")
  return area
}

export const upsertArea = ({ slug, ...rest }: AreaInput) => AreaModel.findOneAndUpdate({ slug }, rest, { upsert: true, new: true, runValidators: true })

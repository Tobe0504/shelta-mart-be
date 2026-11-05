import { notFound } from "../../lib/errors.ts"
import { paged, skip } from "../../lib/paginate.ts"
import { uniqueSlug } from "../../lib/slugify.ts"
import { EstateModel } from "./estate.model.ts"
import type { EstateInput, ListEstatesInput, UpdateEstateInput } from "./estate.schema.ts"

export async function listEstates({ kind, city, ...page }: ListEstatesInput) {
  const filter = { active: true, ...(kind && { kind }), ...(city && { city }) }
  const [items, total, counts, cities] = await Promise.all([
    EstateModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit),
    EstateModel.countDocuments(filter),
    EstateModel.aggregate<{ _id: string; count: number }>([{ $match: { active: true } }, { $group: { _id: "$kind", count: { $sum: 1 } } }]),
    EstateModel.distinct("city", { active: true }),
  ])
  // Counts and cities power the filter chips and city picker.
  return { ...paged(items, total, page), facets: { kinds: Object.fromEntries(counts.map((c) => [c._id, c.count])), cities: cities.sort() } }
}

export async function getEstate(slug: string) {
  const estate = await EstateModel.findOne({ slug, active: true })
  if (!estate) throw notFound("Property")
  return estate
}

/** Every listing, hidden ones included, newest first. */
export const listAllEstates = () => EstateModel.find().sort({ createdAt: -1 })

export async function deleteEstate(slug: string) {
  const { deletedCount } = await EstateModel.deleteOne({ slug })
  if (!deletedCount) throw notFound("Property")
}

export const createEstate = (input: EstateInput) => EstateModel.create({ ...input, slug: uniqueSlug(input.name) })

export async function updateEstate(slug: string, input: UpdateEstateInput) {
  const estate = await EstateModel.findOneAndUpdate({ slug }, input, { new: true, runValidators: true })
  if (!estate) throw notFound("Property")
  return estate
}

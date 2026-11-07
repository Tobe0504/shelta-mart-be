import { contains } from "../../lib/regex.ts"
import { CategoryModel, DepartmentModel } from "../catalog/catalog.model.ts"
import { EstateModel } from "../estates/estate.model.ts"
import { ProductModel } from "../products/product.model.ts"
import { ProModel } from "../pros/pro.model.ts"
import type { SearchInput } from "./search.schema.ts"

/**
 * One search across the whole marketplace for the spotlight: products, categories and trades,
 * departments, pros and properties. Each group is short; "see all" links take over from there.
 */
export async function searchEverything({ q }: SearchInput) {
  const match = contains(q)
  const [departments, categories] = await Promise.all([DepartmentModel.find({ name: match }).limit(4).lean(), CategoryModel.find({ name: match }).limit(8).lean()])
  const kinds = new Map((await DepartmentModel.find().select("slug kind").lean()).map((d) => [d.slug, d.kind]))
  const tradeSlugs = categories.filter((c) => kinds.get(c.department) === "services").map((c) => c.slug)

  const [products, pros, estates] = await Promise.all([
    ProductModel.find({ status: { $ne: "draft" }, $or: [{ name: match }, { brand: match }] })
      .select("slug name price unit images category")
      .sort({ rating: -1 })
      .limit(5)
      .lean(),
    ProModel.find({ active: true, $or: [{ name: match }, { headline: match }, { location: match }, { trades: { $in: tradeSlugs } }] })
      .select("slug name headline photo verified rating location")
      .sort({ verified: -1, rating: -1 })
      .limit(5)
      .lean(),
    EstateModel.find({ active: true, $or: [{ name: match }, { area: match }, { city: match }, { kind: match }] })
      .select("slug name kind area city price per images")
      .limit(4)
      .lean(),
  ])

  const id = <T extends { _id: unknown }>({ _id, ...rest }: T) => ({ id: String(_id), ...rest })
  return {
    departments: departments.map((d) => ({ slug: d.slug, name: d.name, tone: d.tone })),
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, tone: c.tone, service: kinds.get(c.department) === "services" })),
    products: products.map(id),
    pros: pros.map(id),
    estates: estates.map(id),
  }
}

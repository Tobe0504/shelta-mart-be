import { badRequest, conflict, notFound } from "../../lib/errors.ts"
import { ProductModel } from "../products/product.model.ts"
import { CategoryModel, DepartmentModel } from "./catalog.model.ts"
import type { CatalogKind, CategoryInput, DepartmentInput, UpdateCategoryInput } from "./catalog.schema.ts"

/** Departments of one kind (or all), in order, each with its categories. */
export async function getCatalog(kind: CatalogKind) {
  const [departments, categories] = await Promise.all([
    DepartmentModel.find(kind === "all" ? {} : kind === "products" ? { kind: { $ne: "services" } } : { kind }).sort({ kind: 1, order: 1 }).lean(),
    CategoryModel.find().sort("order").lean(),
  ])
  return departments.map(({ _id, ...d }) => ({
    id: String(_id),
    ...d,
    categories: categories.filter((c) => c.department === d.slug).map(({ _id: id, ...c }) => ({ id: String(id), ...c })),
  }))
}

export async function getCategory(slug: string) {
  const category = await CategoryModel.findOne({ slug })
  if (!category) throw notFound("Category")
  return category
}

/** Throws unless `slug` is a product category (not a service trade). */
export async function assertCategory(slug: string) {
  const category = await CategoryModel.findOne({ slug }).select("department").lean()
  if (!category || (await DepartmentModel.exists({ slug: category.department, kind: "services" }))) throw badRequest(`Unknown category “${slug}”`)
}

/** Throws unless every slug is a category in a services department. */
export async function assertTrades(slugs: string[]) {
  const departments = await DepartmentModel.find({ kind: "services" }).distinct("slug")
  const found = await CategoryModel.countDocuments({ slug: { $in: slugs }, department: { $in: departments } })
  if (found !== new Set(slugs).size) throw badRequest("Choose trades from the services list")
}

export const upsertDepartment = ({ slug, ...rest }: DepartmentInput) =>
  DepartmentModel.findOneAndUpdate({ slug }, rest, { upsert: true, new: true, runValidators: true })

export async function deleteDepartment(slug: string) {
  if (await CategoryModel.exists({ department: slug })) throw conflict("Move or delete this department’s categories first")
  const { deletedCount } = await DepartmentModel.deleteOne({ slug })
  if (!deletedCount) throw notFound("Department")
}

export async function createCategory(input: CategoryInput) {
  if (!(await DepartmentModel.exists({ slug: input.department }))) throw badRequest(`Unknown department “${input.department}”`)
  return CategoryModel.create(input)
}

export async function updateCategory(slug: string, input: UpdateCategoryInput) {
  if (input.department && !(await DepartmentModel.exists({ slug: input.department }))) throw badRequest(`Unknown department “${input.department}”`)
  const category = await CategoryModel.findOneAndUpdate({ slug }, input, { new: true, runValidators: true })
  if (!category) throw notFound("Category")
  return category
}

export async function deleteCategory(slug: string) {
  if (await ProductModel.exists({ category: slug })) throw conflict("Move this category’s products before deleting it")
  const { deletedCount } = await CategoryModel.deleteOne({ slug })
  if (!deletedCount) throw notFound("Category")
}

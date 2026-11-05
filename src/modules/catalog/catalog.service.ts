import { badRequest, conflict, notFound } from "../../lib/errors.ts"
import { ProductModel } from "../products/product.model.ts"
import { CategoryModel, DepartmentModel } from "./catalog.model.ts"
import type { CategoryInput, DepartmentInput, UpdateCategoryInput } from "./catalog.schema.ts"

/** Departments in order, each with its categories. */
export async function getCatalog() {
  const [departments, categories] = await Promise.all([DepartmentModel.find().sort("order").lean(), CategoryModel.find().sort("order").lean()])
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

export async function assertCategory(slug: string) {
  if (!(await CategoryModel.exists({ slug }))) throw badRequest(`Unknown category “${slug}”`)
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

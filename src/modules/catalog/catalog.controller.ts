import type { Request, Response } from "express"
import { slug } from "../../lib/validation.ts"
import { categorySchema, departmentSchema, updateCategorySchema } from "./catalog.schema.ts"
import * as catalog from "./catalog.service.ts"

export async function list(_req: Request, res: Response) {
  res.json({ data: await catalog.getCatalog() })
}

export async function getCategory(req: Request, res: Response) {
  res.json({ data: await catalog.getCategory(slug.parse(req.params.slug)) })
}

export async function upsertDepartment(req: Request, res: Response) {
  res.json({ data: await catalog.upsertDepartment(departmentSchema.parse(req.body)) })
}

export async function deleteDepartment(req: Request, res: Response) {
  await catalog.deleteDepartment(slug.parse(req.params.slug))
  res.status(204).end()
}

export async function createCategory(req: Request, res: Response) {
  res.status(201).json({ data: await catalog.createCategory(categorySchema.parse(req.body)) })
}

export async function updateCategory(req: Request, res: Response) {
  res.json({ data: await catalog.updateCategory(slug.parse(req.params.slug), updateCategorySchema.parse(req.body)) })
}

export async function deleteCategory(req: Request, res: Response) {
  await catalog.deleteCategory(slug.parse(req.params.slug))
  res.status(204).end()
}

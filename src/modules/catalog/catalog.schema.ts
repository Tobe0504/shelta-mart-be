import { z } from "zod"
import { slug, text } from "../../lib/validation.ts"
import { departmentKinds, tones } from "./catalog.model.ts"

export const departmentSchema = z.object({ slug, name: text(80), kind: z.enum(departmentKinds).optional(), order: z.number().int().optional() })
export const catalogQuerySchema = z.object({ kind: z.enum([...departmentKinds, "all"]).default("products") })
export const categorySchema = z.object({ slug, name: text(80), tone: z.enum(tones), department: slug, order: z.number().int().optional() })
export const updateCategorySchema = categorySchema.omit({ slug: true }).partial()

export type CatalogKind = z.infer<typeof catalogQuerySchema>["kind"]
export type DepartmentInput = z.infer<typeof departmentSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

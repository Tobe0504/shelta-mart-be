import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const tones = ["blue", "peach", "mint", "lilac", "yellow", "pink", "teal", "slate", "lime"] as const

const departmentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  schemaOptions(),
)

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    tone: { type: String, enum: tones, default: "slate" },
    department: { type: String, required: true, index: true },
    order: { type: Number, default: 0 },
  },
  schemaOptions(),
)

export type Department = InferSchemaType<typeof departmentSchema>
export type Category = InferSchemaType<typeof categorySchema>
export const DepartmentModel = model("Department", departmentSchema)
export const CategoryModel = model("Category", categorySchema)

import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

/** Products are sold through the cart; services are trades people hire through job requests. */
export const departmentKinds = ["products", "services"] as const

export const tones = ["blue", "peach", "mint", "lilac", "yellow", "pink", "teal", "slate", "lime"] as const

const departmentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: departmentKinds, default: "products", index: true },
    /** Shown as a tile on the home page, in `order`. */
    featured: { type: Boolean, default: false },
    tone: { type: String, enum: tones, default: "blue" },
    /** One line under the name on the department page. */
    blurb: { type: String, trim: true },
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

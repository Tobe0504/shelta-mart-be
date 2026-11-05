import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"
import { roles } from "../../lib/tokens.ts"

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, default: "buyer" },
    avatar: String,
    notify: {
      whatsapp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    saved: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    /** Bumped on sign-out and password change to revoke refresh tokens. */
    tokenVersion: { type: Number, default: 0, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  schemaOptions(["passwordHash", "tokenVersion", "resetTokenHash", "resetExpires"]),
)

export type User = InferSchemaType<typeof userSchema>
export const UserModel = model("User", userSchema)

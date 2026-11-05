import type { SchemaOptions } from "mongoose"

/**
 * Shared Mongoose options: timestamps, and JSON output with `id` instead of `_id`, no `__v`,
 * and without any `hidden` fields (secrets that must never reach a response).
 */
export const schemaOptions = (hidden: string[] = []) =>
  ({
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        delete ret._id
        for (const key of hidden) delete ret[key]
        return ret
      },
    },
  }) satisfies SchemaOptions

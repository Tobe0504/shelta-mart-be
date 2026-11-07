import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const notificationKinds = ["job", "quote", "hired", "payment", "payout", "message", "order", "system"] as const

/** Something a person should know about, shown in the bell menu and pushed live. */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: notificationKinds, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    /** Where tapping it goes. */
    href: String,
    read: { type: Boolean, default: false, index: true },
  },
  schemaOptions(),
)
notificationSchema.index({ user: 1, createdAt: -1 })

export type Notification = InferSchemaType<typeof notificationSchema>
export const NotificationModel = model("Notification", notificationSchema)

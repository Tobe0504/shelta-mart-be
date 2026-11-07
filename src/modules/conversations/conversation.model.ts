import { model, Schema, type InferSchemaType } from "mongoose"
import { schemaOptions } from "../../lib/schema.ts"

export const conversationKinds = ["store", "pro", "support"] as const
export const supportStatuses = ["open", "resolved"] as const
/** Read markers use a user id, or "support" for the SheltaMart team as a whole. */
export const SUPPORT = "support"

/**
 * A chat thread. `store` and `pro` threads are between a buyer and a seller or pro (`participants`);
 * `support` threads are between one person and the SheltaMart team (any admin can answer).
 * `about` links the thread to what it's about: a product, order or job.
 */
const conversationSchema = new Schema(
  {
    kind: { type: String, enum: conversationKinds, required: true, index: true },
    participants: { type: [Schema.Types.ObjectId], ref: "User", index: true },
    store: { type: Schema.Types.ObjectId, ref: "Store" },
    pro: { type: Schema.Types.ObjectId, ref: "Pro" },
    subject: { type: String, required: true, trim: true },
    about: { _id: false, label: String, href: String },
    status: { type: String, enum: supportStatuses, default: "open", index: true },
    last: { _id: false, body: String, sender: { type: Schema.Types.ObjectId, ref: "User" }, at: Date },
    reads: [{ _id: false, who: { type: String, required: true }, at: { type: Date, required: true } }],
  },
  schemaOptions(),
)
conversationSchema.index({ "last.at": -1 })

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** True when an admin answered a support thread, so it shows as "SheltaMart support". */
    fromSupport: { type: Boolean, default: false },
    body: { type: String, required: true, trim: true },
  },
  schemaOptions(),
)
messageSchema.index({ conversation: 1, createdAt: -1 })

export type Conversation = InferSchemaType<typeof conversationSchema>
export type Message = InferSchemaType<typeof messageSchema>
export const ConversationModel = model("Conversation", conversationSchema)
export const MessageModel = model("Message", messageSchema)

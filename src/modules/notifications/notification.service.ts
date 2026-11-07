import { env } from "../../config/env.ts"
import { sendMail } from "../../lib/mailer.ts"
import { emitTo } from "../../lib/realtime.ts"
import { UserModel } from "../users/user.model.ts"
import { NotificationModel, type Notification } from "./notification.model.ts"
import type { MarkReadInput } from "./notification.schema.ts"

type Note = Pick<Notification, "kind" | "title"> & { body?: string; href?: string; email?: boolean }

/**
 * Tells people something: saves it for the bell menu, pushes it live, and emails anyone who
 * keeps email notifications on (unless `email: false`).
 */
export async function notify(users: unknown | unknown[], { email = true, ...note }: Note) {
  const ids = [...new Set([users].flat().filter(Boolean).map(String))]
  if (!ids.length) return
  const docs = await NotificationModel.insertMany(ids.map((user) => ({ user, ...note })))
  for (const doc of docs) emitTo(String(doc.user), "notification", doc.toJSON())
  if (!email) return
  const recipients = await UserModel.find({ _id: { $in: ids }, "notify.email": { $ne: false } }).select("email")
  await Promise.all(recipients.map((u) => sendMail({ to: u.email, subject: note.title, text: [note.body, note.href && `${env.CLIENT_URL}${note.href}`].filter(Boolean).join("\n\n") })))
}

export async function listMine(user: string) {
  const [items, unread] = await Promise.all([NotificationModel.find({ user }).sort({ createdAt: -1 }).limit(30), NotificationModel.countDocuments({ user, read: false })])
  return { items, unread }
}

/** Marks the given notifications (or all of them) read. */
export async function markRead(user: string, { ids }: MarkReadInput) {
  await NotificationModel.updateMany({ user, read: false, ...(ids && { _id: { $in: ids } }) }, { read: true })
  return listMine(user)
}

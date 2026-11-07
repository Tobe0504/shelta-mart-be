import { isValidObjectId, type QueryFilter } from "mongoose"
import { env } from "../../config/env.ts"
import { badRequest, forbidden, notFound } from "../../lib/errors.ts"
import { sendMail } from "../../lib/mailer.ts"
import { emitTo, emitToAdmins } from "../../lib/realtime.ts"
import type { AuthUser } from "../../lib/tokens.ts"
import { notify } from "../notifications/notification.service.ts"
import { ProModel } from "../pros/pro.model.ts"
import { StoreModel } from "../stores/store.model.ts"
import { UserModel } from "../users/user.model.ts"
import { ConversationModel, MessageModel, SUPPORT, type Conversation } from "./conversation.model.ts"
import type { ListInput, StartInput } from "./conversation.schema.ts"

type ConversationDoc = NonNullable<Awaited<ReturnType<typeof ConversationModel.findOne>>>
type Person = { _id: unknown; name: string; avatar?: string | null; email?: string }
type Populated = Omit<ConversationDoc, "participants" | "store" | "pro"> & {
  participants: Person[]
  store?: { _id: unknown; name: string; owner: unknown } | null
  pro?: { _id: unknown; name: string; slug: string; photo?: string | null; owner: unknown } | null
}

const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)
const isParticipant = (c: { participants: unknown[] }, user: AuthUser) => c.participants.some((p) => same((p as Person)._id ?? p, user.id))
/** Admins answering a support thread read it as the team, so any admin clears it for all. */
const readerKey = (c: Pick<Conversation, "kind" | "participants">, user: AuthUser) => (c.kind === "support" && user.role === "admin" && !isParticipant(c, user) ? SUPPORT : user.id)

function assertAccess(c: Pick<Conversation, "kind" | "participants">, user: AuthUser) {
  if (isParticipant(c, user) || (c.kind === "support" && user.role === "admin")) return
  throw forbidden()
}

const populate = <T>(q: T) =>
  (q as unknown as ReturnType<typeof ConversationModel.find>)
    .populate("participants", "name avatar email")
    .populate("store", "name owner")
    .populate("pro", "name slug photo owner") as unknown as T

/** A thread as one person sees it: who they're talking to, and whether there's anything new. */
function view(c: Populated, user: AuthUser) {
  const json = (c as unknown as ConversationDoc).toJSON() as Record<string, unknown>
  const me = readerKey(c as unknown as Conversation, user)
  const readAt = c.reads.find((r) => r.who === me)?.at
  const unread = !!c.last?.at && !same(c.last.sender, user.id) && (!readAt || readAt < c.last.at)
  const other = c.participants.find((p) => !same(p._id, user.id))
  const ownsStore = same(c.store?.owner, user.id)
  const ownsPro = same(c.pro?.owner, user.id)
  const counterpart =
    c.kind === "support"
      ? me === SUPPORT
        ? { name: c.participants[0]?.name ?? "Customer", avatar: c.participants[0]?.avatar ?? undefined }
        : { name: "SheltaMart support" }
      : c.kind === "store"
        ? ownsStore
          ? { name: other?.name ?? "Buyer", avatar: other?.avatar ?? undefined }
          : { name: c.store?.name ?? "Seller" }
        : ownsPro
          ? { name: other?.name ?? "Buyer", avatar: other?.avatar ?? undefined }
          : { name: c.pro?.name ?? "Pro", avatar: c.pro?.photo ?? undefined, href: c.pro && `/pros/${c.pro.slug}` }
  return { id: json.id, kind: c.kind, subject: c.subject, about: c.about, status: c.status, last: c.last, unread, counterpart, updatedAt: json.updatedAt }
}

const findPopulated = (id: string) => populate(ConversationModel.findById(id)) as unknown as Promise<Populated | null>

/** Everyone who should receive a live update for this thread. */
function recipients(c: Populated) {
  return c.participants.map((p) => String(p._id))
}

/** Starts a thread (or reuses the existing one with the same person) and sends the first message. */
export async function start(user: AuthUser, input: StartInput) {
  let conversation: ConversationDoc
  if (input.store) {
    const store = await StoreModel.findOne(isValidObjectId(input.store) ? { _id: input.store } : { slug: input.store }).select("owner name")
    if (!store) throw notFound("Store")
    if (same(store.owner, user.id)) throw badRequest("That’s your own store")
    conversation =
      (await ConversationModel.findOne({ kind: "store", store: store._id, participants: { $all: [user.id, store.owner] } })) ??
      new ConversationModel({ kind: "store", store: store._id, participants: [user.id, store.owner], subject: input.subject ?? store.name })
  } else if (input.pro) {
    const pro = await ProModel.findOne({ slug: input.pro }).select("owner name")
    if (!pro) throw notFound("Pro")
    if (same(pro.owner, user.id)) throw badRequest("You can’t message yourself")
    conversation =
      (await ConversationModel.findOne({ kind: "pro", pro: pro._id, participants: { $all: [user.id, pro.owner] } })) ??
      new ConversationModel({ kind: "pro", pro: pro._id, participants: [user.id, pro.owner], subject: input.subject ?? pro.name })
  } else {
    conversation =
      (await ConversationModel.findOne({ kind: "support", participants: user.id, status: "open" })) ??
      new ConversationModel({ kind: "support", participants: [user.id], subject: input.subject ?? "Help request" })
  }
  if (input.about) conversation.about = input.about
  await conversation.save()
  return send(user, String(conversation._id), input.body)
}

/** Adds a message, pushes it live to everyone in the thread, and emails anyone who had nothing unread. */
export async function send(user: AuthUser, id: string, body: string) {
  const c = await findPopulated(id)
  if (!c) throw notFound("Conversation")
  assertAccess(c as unknown as Conversation, user)
  const fromSupport = c.kind === "support" && readerKey(c as unknown as Conversation, user) === SUPPORT
  const message = await MessageModel.create({ conversation: c._id, sender: user.id, body, fromSupport })
  const doc = c as unknown as ConversationDoc
  const reopened = c.kind === "support" && !fromSupport && c.status === "resolved"
  // Snapshot before updating: `c` and `doc` are the same object.
  const before = c.reads.map((r) => ({ who: r.who, at: r.at }))
  const prev = c.last?.at ? { at: c.last.at, sender: c.last.sender } : null
  const hadUnread = (who: string) => {
    const at = before.find((r) => r.who === who)?.at
    return !!prev && !same(prev.sender, who) && (!at || at < prev.at)
  }
  doc.set({
    last: { body, sender: user.id, at: message.createdAt },
    reads: [...before.filter((r) => r.who !== readerKey(c as unknown as Conversation, user)), { who: readerKey(c as unknown as Conversation, user), at: message.createdAt }],
    ...(c.kind === "support" && !fromSupport && { status: "open" }),
  })
  await doc.save()

  const fresh = (await findPopulated(id))!
  const payload = (viewer: AuthUser) => ({ conversation: view(fresh, viewer), message: message.toJSON() })
  for (const pid of recipients(fresh)) emitTo(pid, "message", payload({ id: pid, role: "buyer" }))
  if (c.kind === "support") {
    emitToAdmins("message", payload({ id: "", role: "admin" }))
    if (!fromSupport && (reopened || !prev)) {
      const admins = await UserModel.find({ role: "admin" }).distinct("_id")
      await notify(admins, { kind: "message", title: `Help desk: ${c.subject}`, body: `${c.participants[0]?.name}: ${body.slice(0, 140)}`, href: `/admin/support/${id}`, email: false })
    }
  }

  // Email people who weren't already waiting on an unread message here, so a burst of chat sends one email.
  const sender = c.participants.find((p) => same(p._id, user.id))?.name ?? (fromSupport ? "SheltaMart support" : "Someone")
  const offline = c.participants.filter((p) => !same(p._id, user.id) && !hadUnread(String(p._id)) && p.email)
  await Promise.all(offline.map((p) => sendMail({ to: p.email!, subject: `New message from ${fromSupport ? "SheltaMart support" : sender}`, text: `${body.slice(0, 500)}\n\nReply: ${env.CLIENT_URL}/messages/${id}` })))

  return { conversation: view(fresh, user), message }
}

/** The signed-in person's threads, newest first; admins can list the help desk with `scope: "support"`. */
export async function list(user: AuthUser, { scope, status }: ListInput) {
  if (scope === "support" && user.role !== "admin") throw forbidden()
  const filter: QueryFilter<Conversation> = scope === "support" ? { kind: "support", ...(status && { status }) } : { participants: user.id }
  const items = (await populate(ConversationModel.find(filter).sort({ "last.at": -1 }).limit(100))) as unknown as Populated[]
  return items.map((c) => view(c, user))
}

/** How many threads have something new: the person's own, and (for admins) the help desk. */
export async function unread(user: AuthUser) {
  const mine = (await list(user, { scope: "mine" })).filter((c) => c.unread).length
  const support = user.role === "admin" ? (await list(user, { scope: "support", status: "open" })).filter((c) => c.unread).length : 0
  return { mine, support }
}

/** A thread's latest messages, oldest first; opening it marks it read. */
export async function messages(user: AuthUser, id: string) {
  const c = await findPopulated(id)
  if (!c) throw notFound("Conversation")
  assertAccess(c as unknown as Conversation, user)
  const key = readerKey(c as unknown as Conversation, user)
  await ConversationModel.updateOne({ _id: c._id }, { $pull: { reads: { who: key } } })
  await ConversationModel.updateOne({ _id: c._id }, { $push: { reads: { who: key, at: new Date() } } })
  const list = await MessageModel.find({ conversation: c._id }).sort({ createdAt: -1 }).limit(200)
  const fresh = (await findPopulated(id))!
  return { conversation: view(fresh, user), messages: list.reverse() }
}

/** Opens or resolves a help desk thread (the person who asked, or any admin). */
export async function setStatus(user: AuthUser, id: string, status: Conversation["status"]) {
  const c = await ConversationModel.findById(id)
  if (!c || c.kind !== "support") throw notFound("Help request")
  assertAccess(c, user)
  c.status = status
  await c.save()
  const fresh = (await findPopulated(id))!
  return view(fresh, user)
}

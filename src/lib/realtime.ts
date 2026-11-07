import type { Server as HttpServer } from "node:http"
import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import { env } from "../config/env.ts"
import { logger } from "./logger.ts"
import { roles, type AuthUser } from "./tokens.ts"

/**
 * Live updates over Socket.IO. Browsers can't send the API's auth cookies across domains,
 * so they fetch a short-lived socket ticket over the normal (proxied, cookie-authenticated) API first.
 * Every socket joins `user:<id>`; admins also join `admins`.
 */
let io: Server | null = null
const TICKET_TTL = 60

export const socketTicket = (user: AuthUser) => jwt.sign({ role: user.role, use: "socket" }, env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: TICKET_TTL })

function readTicket(token: unknown): AuthUser | null {
  if (typeof token !== "string") return null
  try {
    const { sub, role, use } = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    return sub && use === "socket" && roles.includes(role) ? { id: sub, role } : null
  } catch {
    return null
  }
}

export function startRealtime(server: HttpServer) {
  io = new Server(server, { path: "/realtime", cors: { origin: env.CLIENT_URL, credentials: true } })
  io.use((socket, next) => {
    const user = readTicket(socket.handshake.auth?.token)
    if (!user) return next(new Error("unauthorized"))
    socket.data.user = user
    next()
  })
  io.on("connection", (socket) => {
    const user = socket.data.user as AuthUser
    socket.join(`user:${user.id}`)
    if (user.role === "admin") socket.join("admins")
  })
  logger.info("Realtime ready on /realtime")
  return io
}

/** Pushes an event to everyone signed in as these users (no-op before startup, e.g. in scripts). */
export function emitTo(userIds: string | string[], event: string, payload: unknown) {
  if (!io) return
  for (const id of [userIds].flat()) io.to(`user:${id}`).emit(event, payload)
}

export const emitToAdmins = (event: string, payload: unknown) => io?.to("admins").emit(event, payload)

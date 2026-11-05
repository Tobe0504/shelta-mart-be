import mongoose from "mongoose"
import { env } from "./env.ts"
import { logger } from "../lib/logger.ts"

// NoSQL injection guard: every request value is parsed by Zod into a plain string/number before it
// reaches a query, and Express 5's default query parser never builds nested objects like `q[$ne]`.
mongoose.set("strictQuery", true)

export async function connectDb(uri = env.MONGODB_URI) {
  await mongoose.connect(uri)
  logger.info({ db: mongoose.connection.name }, "MongoDB connected")
}

export const disconnectDb = () => mongoose.disconnect()

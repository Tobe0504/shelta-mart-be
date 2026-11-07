import { createApp } from "./app.ts"
import { connectDb, disconnectDb } from "./config/db.ts"
import { env } from "./config/env.ts"
import { logger } from "./lib/logger.ts"
import { startRealtime } from "./lib/realtime.ts"

await connectDb()
const server = createApp().listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`))
startRealtime(server)

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`)
  server.close(() => disconnectDb().finally(() => process.exit(0)))
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

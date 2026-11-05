import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { env } from "./config/env.ts"
import { logger } from "./lib/logger.ts"
import { authenticate } from "./middleware/auth.ts"
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts"
import { apiRoutes } from "./routes.ts"

export function createApp() {
  const app = express()
  app.set("trust proxy", 1)
  app.disable("x-powered-by")

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }))
  // Keep the raw body so webhook signatures can be verified.
  app.use(express.json({ limit: "1mb", verify: (req: express.Request, _res, buf) => (req.rawBody = buf) }))
  app.use(cookieParser())
  app.use(authenticate)

  app.get("/health", (_req, res) => res.json({ ok: true }))
  app.use("/api/v1", apiRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

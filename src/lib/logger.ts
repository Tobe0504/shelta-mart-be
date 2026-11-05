import { pino } from "pino"
import { env, isProd } from "../config/env.ts"

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  transport: isProd ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
})

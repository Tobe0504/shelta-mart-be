import { logger } from "./logger.ts"

export type Mail = { to: string; subject: string; text: string }

/** Placeholder until an email provider is chosen: logs instead of sending. */
export async function sendMail(mail: Mail) {
  logger.info({ mail }, "Email (not sent: no provider configured)")
}

import type { AuthUser } from "../lib/tokens.ts"

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` when a valid access token is present. */
      user?: AuthUser
      /** Raw JSON body, kept for verifying webhook signatures. */
      rawBody?: Buffer
    }
  }
}

export {}

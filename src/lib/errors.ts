/** An error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, "bad_request", message, details)
export const unauthorized = (message = "Sign in to continue") => new AppError(401, "unauthorized", message)
export const forbidden = (message = "You don’t have access to this") => new AppError(403, "forbidden", message)
export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`)
export const conflict = (message: string) => new AppError(409, "conflict", message)
export const unavailable = (message: string) => new AppError(503, "unavailable", message)

import type { NextFunction, Request, Response } from "express"
import mongoose from "mongoose"
import { z } from "zod"
import { AppError } from "../lib/errors.ts"
import { logger } from "../lib/logger.ts"

type Body = { error: { code: string; message: string; details?: unknown } }

function toResponse(err: unknown): [number, Body] {
  if (err instanceof AppError) return [err.status, { error: { code: err.code, message: err.message, details: err.details } }]
  if (err instanceof z.ZodError)
    return [400, { error: { code: "invalid_input", message: "Check the highlighted fields", details: z.flattenError(err).fieldErrors } }]
  if (err instanceof mongoose.Error.CastError) return [400, { error: { code: "bad_request", message: `Invalid ${err.path}` } }]
  if (err instanceof mongoose.Error.ValidationError) return [400, { error: { code: "invalid_input", message: err.message } }]
  if (typeof err === "object" && err && "code" in err && err.code === 11000) {
    const field = Object.keys((err as { keyValue?: object }).keyValue ?? {})[0] ?? "value"
    return [409, { error: { code: "conflict", message: `That ${field} is already in use` } }]
  }
  if (err instanceof SyntaxError && "body" in err) return [400, { error: { code: "bad_request", message: "Malformed JSON body" } }]
  return [500, { error: { code: "internal", message: "Something went wrong. Please try again." } }]
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const [status, body] = toResponse(err)
  if (status >= 500) logger.error({ err, path: req.path }, "Unhandled error")
  res.status(status).json(body)
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: `No route for ${req.method} ${req.path}` } })
}

import type { Request, Response } from "express"
import { z } from "zod"
import { signUpload, uploadKinds } from "./upload.service.ts"

export function sign(req: Request, res: Response) {
  const { kind } = z.object({ kind: z.enum(uploadKinds) }).parse(req.body)
  res.json({ data: signUpload(kind, req.user) })
}

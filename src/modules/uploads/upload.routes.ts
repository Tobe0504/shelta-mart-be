import { Router } from "express"
import { formLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./upload.controller.ts"

export const uploadRoutes = Router().post("/uploads/sign", formLimiter, c.sign)

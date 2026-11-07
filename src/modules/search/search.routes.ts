import { Router } from "express"
import * as c from "./search.controller.ts"

export const searchRoutes = Router().get("/search", c.search)

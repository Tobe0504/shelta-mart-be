import { Router } from "express"
import { geoLimiter } from "../../middleware/rate-limit.ts"
import * as c from "./geo.controller.ts"

export const geoRoutes = Router().use("/geo", geoLimiter).get("/geo/search", c.search).get("/geo/reverse", c.reverse)

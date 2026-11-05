import { Router } from "express"
import { requireAuth } from "../../middleware/auth.ts"
import * as c from "./catalog.controller.ts"

const admin = requireAuth("admin")

export const catalogRoutes = Router()
  .get("/catalog", c.list)
  .get("/categories/:slug", c.getCategory)
  .put("/admin/departments", admin, c.upsertDepartment)
  .delete("/admin/departments/:slug", admin, c.deleteDepartment)
  .post("/admin/categories", admin, c.createCategory)
  .patch("/admin/categories/:slug", admin, c.updateCategory)
  .delete("/admin/categories/:slug", admin, c.deleteCategory)

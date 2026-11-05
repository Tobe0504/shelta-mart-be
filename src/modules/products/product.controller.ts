import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { slug } from "../../lib/validation.ts"
import { productSchema, searchSchema, sellerListSchema, updateProductSchema } from "./product.schema.ts"
import * as products from "./product.service.ts"

export async function search(req: Request, res: Response) {
  res.json(await products.search(searchSchema.parse(req.query)))
}

export async function brands(req: Request, res: Response) {
  res.json({ data: await products.brands(slug.optional().parse(req.query.category)) })
}

export async function get(req: Request, res: Response) {
  res.json({ data: await products.getBySlug(slug.parse(req.params.slug)) })
}

export async function related(req: Request, res: Response) {
  res.json({ data: await products.related(slug.parse(req.params.slug)) })
}

export async function listOwn(req: Request, res: Response) {
  res.json(await products.listOwn(currentUser(req).id, sellerListSchema.parse(req.query)))
}

export async function getOwn(req: Request, res: Response) {
  res.json({ data: await products.getOwnProduct(currentUser(req).id, slug.parse(req.params.slug)) })
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await products.createOwn(currentUser(req).id, productSchema.parse(req.body)) })
}

export async function update(req: Request, res: Response) {
  res.json({ data: await products.updateOwn(currentUser(req).id, slug.parse(req.params.slug), updateProductSchema.parse(req.body)) })
}

export async function remove(req: Request, res: Response) {
  await products.deleteOwn(currentUser(req).id, slug.parse(req.params.slug))
  res.status(204).end()
}

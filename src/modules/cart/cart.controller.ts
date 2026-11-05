import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { cartQuerySchema, mergeSchema, setLineSchema } from "./cart.schema.ts"
import * as cart from "./cart.service.ts"

export async function get(req: Request, res: Response) {
  const { lat, lng } = cartQuerySchema.parse(req.query)
  res.json({ data: await cart.getCart(currentUser(req).id, lat !== undefined && lng !== undefined ? { lat, lng } : undefined) })
}

export async function setLine(req: Request, res: Response) {
  res.json({ data: await cart.setLine(currentUser(req).id, objectId.parse(req.params.productId), setLineSchema.parse(req.body).qty) })
}

export async function merge(req: Request, res: Response) {
  res.json({ data: await cart.mergeLines(currentUser(req).id, mergeSchema.parse(req.body)) })
}

export async function clear(req: Request, res: Response) {
  await cart.clearCart(currentUser(req).id)
  res.status(204).end()
}

import type { Request, Response } from "express"
import { slug } from "../../lib/validation.ts"
import { estateSchema, listEstatesSchema, updateEstateSchema } from "./estate.schema.ts"
import * as estates from "./estate.service.ts"

export async function list(req: Request, res: Response) {
  res.json(await estates.listEstates(listEstatesSchema.parse(req.query)))
}

export async function get(req: Request, res: Response) {
  res.json({ data: await estates.getEstate(slug.parse(req.params.slug)) })
}

export async function listAll(_req: Request, res: Response) {
  res.json({ data: await estates.listAllEstates() })
}

export async function remove(req: Request, res: Response) {
  await estates.deleteEstate(slug.parse(req.params.slug))
  res.status(204).end()
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await estates.createEstate(estateSchema.parse(req.body)) })
}

export async function update(req: Request, res: Response) {
  res.json({ data: await estates.updateEstate(slug.parse(req.params.slug), updateEstateSchema.parse(req.body)) })
}

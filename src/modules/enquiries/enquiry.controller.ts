import type { Request, Response } from "express"
import { currentUser } from "../../middleware/auth.ts"
import { objectId } from "../../lib/validation.ts"
import { createEnquirySchema, listEnquiriesSchema, updateEnquirySchema } from "./enquiry.schema.ts"
import * as enquiries from "./enquiry.service.ts"

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await enquiries.createEnquiry(createEnquirySchema.parse(req.body), req.user?.id) })
}

export async function listForSeller(req: Request, res: Response) {
  res.json(await enquiries.listForSeller(currentUser(req).id, listEnquiriesSchema.parse(req.query)))
}

export async function updateForSeller(req: Request, res: Response) {
  const { status } = updateEnquirySchema.parse(req.body)
  res.json({ data: await enquiries.setStatus(objectId.parse(req.params.id), status, currentUser(req).id) })
}

export async function listAll(req: Request, res: Response) {
  res.json(await enquiries.listAll(listEnquiriesSchema.parse(req.query)))
}

export async function update(req: Request, res: Response) {
  res.json({ data: await enquiries.setStatus(objectId.parse(req.params.id), updateEnquirySchema.parse(req.body).status) })
}

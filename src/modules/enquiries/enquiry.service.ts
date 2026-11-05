import type { QueryFilter } from "mongoose"
import { notFound } from "../../lib/errors.ts"
import { paged, skip } from "../../lib/paginate.ts"
import { EstateModel } from "../estates/estate.model.ts"
import { ProductModel } from "../products/product.model.ts"
import { getOwnStore } from "../stores/store.service.ts"
import { EnquiryModel, type Enquiry } from "./enquiry.model.ts"
import type { CreateEnquiryInput, ListEnquiriesInput } from "./enquiry.schema.ts"

export async function createEnquiry({ topic, target, ...input }: CreateEnquiryInput, user?: string) {
  if (topic === "product") {
    const product = await ProductModel.findOne({ slug: target }).select("store").lean()
    if (!product) throw notFound("Product")
    return EnquiryModel.create({ ...input, topic, user, product: product._id, store: product.store })
  }
  const estate = await EstateModel.findOne({ slug: target }).select("_id").lean()
  if (!estate) throw notFound("Property")
  return EnquiryModel.create({ ...input, topic, user, estate: estate._id })
}

async function list(filter: QueryFilter<Enquiry>, { status, topic, ...page }: ListEnquiriesInput) {
  const query = { ...filter, ...(status && { status }), ...(topic && { topic }) }
  const [items, total] = await Promise.all([
    EnquiryModel.find(query).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit).populate("product", "slug name").populate("estate", "slug name"),
    EnquiryModel.countDocuments(query),
  ])
  return paged(items, total, page)
}

export const listForSeller = async (owner: string, input: ListEnquiriesInput) => list({ store: (await getOwnStore(owner))._id }, input)
export const listAll = (input: ListEnquiriesInput) => list({}, input)

/** Updates status; sellers may only touch their own store's enquiries. */
export async function setStatus(id: string, status: Enquiry["status"], owner?: string) {
  const filter: QueryFilter<Enquiry> = { _id: id, ...(owner && { store: (await getOwnStore(owner))._id }) }
  const enquiry = await EnquiryModel.findOneAndUpdate(filter, { status }, { new: true })
  if (!enquiry) throw notFound("Enquiry")
  return enquiry
}

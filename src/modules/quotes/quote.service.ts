import { notFound } from "../../lib/errors.ts"
import { paged, skip } from "../../lib/paginate.ts"
import { QuoteModel } from "./quote.model.ts"
import type { CreateQuoteInput, ListQuotesInput, UpdateQuoteInput } from "./quote.schema.ts"

export const createQuote = (input: CreateQuoteInput, user?: string) => QuoteModel.create({ ...input, user })

export const listMine = (user: string) => QuoteModel.find({ user }).sort({ createdAt: -1 }).select("-notes")

export async function listAll({ status, ...page }: ListQuotesInput) {
  const filter = status ? { status } : {}
  const [items, total] = await Promise.all([QuoteModel.find(filter).sort({ createdAt: -1 }).skip(skip(page)).limit(page.limit), QuoteModel.countDocuments(filter)])
  return paged(items, total, page)
}

export async function getQuote(id: string) {
  const quote = await QuoteModel.findById(id)
  if (!quote) throw notFound("Quote request")
  return quote
}

export async function updateQuote(id: string, input: UpdateQuoteInput) {
  const quote = await QuoteModel.findByIdAndUpdate(id, input, { new: true, runValidators: true })
  if (!quote) throw notFound("Quote")
  return quote
}

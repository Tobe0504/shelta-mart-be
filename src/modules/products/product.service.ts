import type { QueryFilter } from "mongoose"
import { badRequest, notFound } from "../../lib/errors.ts"
import { paged, skip } from "../../lib/paginate.ts"
import { uniqueSlug } from "../../lib/slugify.ts"
import { CategoryModel } from "../catalog/catalog.model.ts"
import { assertCategory } from "../catalog/catalog.service.ts"
import { PUBLIC_STORE } from "../stores/store.model.ts"
import { getOwnStore } from "../stores/store.service.ts"
import { ProductModel, type Product } from "./product.model.ts"
import type { ProductInput, SearchInput, SellerListInput, UpdateProductInput } from "./product.schema.ts"
import { contains } from "../../lib/regex.ts"

const nameMatch = (q: string) => ({ $or: [{ name: contains(q) }, { brand: contains(q) }] })

const sorts = {
  best: { rating: -1, reviewCount: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  newest: { createdAt: -1 },
} as const

export async function search({ q, category, department, brand, deals, sort, ...page }: SearchInput) {
  const filter: QueryFilter<Product> = { status: { $ne: "draft" } }
  if (q) Object.assign(filter, nameMatch(q))
  if (category) filter.category = category
  else if (department) filter.category = { $in: await CategoryModel.find({ department }).distinct("slug") }
  if (brand.length) filter.brand = { $in: brand }
  if (deals) filter.$expr = { $gt: ["$was", "$price"] }

  const [items, total] = await Promise.all([
    ProductModel.find(filter).sort(sorts[sort]).skip(skip(page)).limit(page.limit).populate("store", PUBLIC_STORE),
    ProductModel.countDocuments(filter),
  ])
  return paged(items, total, page)
}

/** Brands available to filter by, optionally within one category. */
export const brands = (category?: string) => ProductModel.distinct("brand", { status: { $ne: "draft" }, ...(category && { category }) }).then((b) => b.sort())

export async function getBySlug(slug: string) {
  const product = await ProductModel.findOne({ slug, status: { $ne: "draft" } }).populate("store", PUBLIC_STORE)
  if (!product) throw notFound("Product")
  return product
}

export async function related(slug: string, limit = 5) {
  const product = await getBySlug(slug)
  return ProductModel.find({ category: product.category, slug: { $ne: slug }, status: "live" }).sort(sorts.best).limit(limit).populate("store", PUBLIC_STORE)
}

// ——— Seller ———

export async function listOwn(owner: string, { status, q, ...page }: SellerListInput) {
  const store = await getOwnStore(owner)
  const filter: QueryFilter<Product> = { store: store.id, ...(status && { status }), ...(q && nameMatch(q)) }
  const [items, total] = await Promise.all([
    ProductModel.find(filter).sort({ updatedAt: -1 }).skip(skip(page)).limit(page.limit),
    ProductModel.countDocuments(filter),
  ])
  return paged(items, total, page)
}

async function getOwn(owner: string, slug: string) {
  const store = await getOwnStore(owner)
  const product = await ProductModel.findOne({ slug, store: store.id })
  if (!product) throw notFound("Product")
  return product
}

export const getOwnProduct = getOwn

function checkPricing({ price, was, tiers }: { price?: number; was?: number | null; tiers?: { price: number }[] }) {
  if (was != null && price !== undefined && was <= price) throw badRequest("The previous price must be higher than the current price")
  if (tiers && price !== undefined && tiers.some((t) => t.price > price)) throw badRequest("Bulk prices can’t be higher than the base price")
}

export async function createOwn(owner: string, input: ProductInput) {
  const store = await getOwnStore(owner)
  await assertCategory(input.category)
  checkPricing(input)
  return ProductModel.create({ ...input, slug: uniqueSlug(input.name), store: store.id })
}

export async function updateOwn(owner: string, slug: string, input: UpdateProductInput) {
  const product = await getOwn(owner, slug)
  if (input.category) await assertCategory(input.category)
  checkPricing({ price: input.price ?? product.price, was: input.was ?? product.was, tiers: input.tiers ?? product.tiers })
  product.set(input)
  if (product.stock === 0 && product.status === "live") product.status = "out-of-stock"
  return product.save()
}

export async function deleteOwn(owner: string, slug: string) {
  const product = await getOwn(owner, slug)
  await product.deleteOne()
}

import { notFound } from "../../lib/errors.ts"
import { PromoModel } from "./promo.model.ts"
import type { PromoInput, UpdatePromoInput } from "./promo.schema.ts"

/** Running promos. For a category: its targeted promos first, then untargeted ones; otherwise all. */
export async function listRunning(category?: string) {
  const now = new Date()
  const running = await PromoModel.find({
    active: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }],
  }).sort("order")
  if (!category) return running
  const targeted = running.filter((p) => p.category === category)
  return targeted.length ? [...targeted, ...running.filter((p) => !p.category)] : running
}

export const listAll = () => PromoModel.find().sort("order")
export const createPromo = (input: PromoInput) => PromoModel.create(input)

export async function updatePromo(id: string, input: UpdatePromoInput) {
  const promo = await PromoModel.findByIdAndUpdate(id, input, { new: true, runValidators: true })
  if (!promo) throw notFound("Promo")
  return promo
}

export async function deletePromo(id: string) {
  const { deletedCount } = await PromoModel.deleteOne({ _id: id })
  if (!deletedCount) throw notFound("Promo")
}

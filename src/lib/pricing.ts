type Priced = { price: number; tiers?: { min: number; price: number }[] | null }

/** Unit price for a quantity, applying the best matching bulk tier. */
export const unitPrice = (product: Priced, qty: number) =>
  (product.tiers ?? []).filter((t) => qty >= t.min).reduce((best, t) => Math.min(best, t.price), product.price)

/** Percentage rounded to whole naira. */
export const percentOf = (amount: number, rate: number) => Math.round(amount * rate)

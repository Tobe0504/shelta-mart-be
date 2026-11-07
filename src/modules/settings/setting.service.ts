import { SettingModel, type Settings } from "./setting.model.ts"
import type { UpdateSettingsInput } from "./setting.schema.ts"

const KEY = "marketplace"

/** The marketplace settings, created with defaults on first read. */
export const getSettings = () => SettingModel.findOneAndUpdate({ key: KEY }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).orFail()

export const updateSettings = (input: UpdateSettingsInput) =>
  SettingModel.findOneAndUpdate({ key: KEY }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).orFail()

export const commissionFor = (settings: Pick<Settings, "commissionRate" | "categoryCommission">, category: string) =>
  settings.categoryCommission.find((c) => c.category === category)?.rate ?? settings.commissionRate

type SlotRules = { deliveryWindows: string[]; deliveryDaysAhead: number; deliveryDays?: number[] | null }
const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Africa/Lagos" })
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Bookable slots on the next `deliveryDaysAhead` open days (from tomorrow), e.g. "Thu 6 Nov · 8–12".
 * `deliveryDays` limits which weekdays count (0 = Sunday); empty means every day.
 */
export function deliverySlots({ deliveryWindows, deliveryDaysAhead, deliveryDays }: SlotRules, from = new Date()) {
  const open = deliveryDays?.length ? new Set(deliveryDays) : null
  const days: Date[] = []
  for (let i = 1; days.length < deliveryDaysAhead && i <= 21; i++) {
    const date = new Date(from.getTime() + i * 86_400_000)
    if (!open || open.has(WEEK.indexOf(weekday.format(date)))) days.push(date)
  }
  return days.flatMap((date) => deliveryWindows.map((w) => `${dayLabel.format(date).replace(",", "")} · ${w}`))
}

type StoreRules = { deliveryWindows?: string[] | null; deliveryDays?: number[] | null; deliveryDaysAhead?: number | null; offloadFee?: number | null }

/** A store's slots, falling back to the marketplace defaults for anything it hasn't set. */
export const storeSlots = (store: StoreRules, settings: Pick<Settings, "deliveryWindows" | "deliveryDaysAhead">) =>
  deliverySlots({
    deliveryWindows: store.deliveryWindows?.length ? store.deliveryWindows : settings.deliveryWindows,
    deliveryDaysAhead: store.deliveryDaysAhead ?? settings.deliveryDaysAhead,
    deliveryDays: store.deliveryDays,
  })

/** A store's offloading price, never below the marketplace minimum. */
export const storeOffloadFee = (store: StoreRules, settings: Pick<Settings, "offloadFee">) => Math.max(store.offloadFee ?? settings.offloadFee, settings.offloadFee)

/** What buyers see at checkout; commission rates stay private. */
export async function publicSettings() {
  const s = await getSettings()
  const { offloadFee, serviceFee, deliveryBaseFee, deliveryPerKm, deliveryMinFee, roadFactor, maxDeliveryKm, deliveryWindows, deliveryDaysAhead } = s
  return {
    offloadFee,
    serviceFee,
    deliverySlots: deliverySlots(s),
    /** Defaults a store uses until it sets its own. */
    deliveryWindows,
    deliveryDaysAhead,
    delivery: { deliveryBaseFee, deliveryPerKm, deliveryMinFee, roadFactor, maxDeliveryKm },
  }
}

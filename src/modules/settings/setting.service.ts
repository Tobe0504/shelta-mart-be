import { SettingModel, type Settings } from "./setting.model.ts"
import type { UpdateSettingsInput } from "./setting.schema.ts"

const KEY = "marketplace"

/** The marketplace settings, created with defaults on first read. */
export const getSettings = () => SettingModel.findOneAndUpdate({ key: KEY }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).orFail()

export const updateSettings = (input: UpdateSettingsInput) =>
  SettingModel.findOneAndUpdate({ key: KEY }, { $set: input }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).orFail()

export const commissionFor = (settings: Pick<Settings, "commissionRate" | "categoryCommission">, category: string) =>
  settings.categoryCommission.find((c) => c.category === category)?.rate ?? settings.commissionRate

/** Bookable delivery slots for the next `deliveryDaysAhead` days (from tomorrow), e.g. "Thu 6 Nov · 8–12". */
export function deliverySlots(settings: Pick<Settings, "deliveryWindows" | "deliveryDaysAhead">, from = new Date()) {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })
  return Array.from({ length: settings.deliveryDaysAhead }, (_, i) => {
    const date = new Date(from.getTime() + (i + 1) * 86_400_000)
    return settings.deliveryWindows.map((w) => `${day.format(date).replace(",", "")} · ${w}`)
  }).flat()
}

/** What buyers see at checkout; commission rates stay private. */
export async function publicSettings() {
  const s = await getSettings()
  const { offloadFee, serviceFee, deliveryBaseFee, deliveryPerKm, deliveryMinFee, roadFactor, maxDeliveryKm } = s
  return { offloadFee, serviceFee, deliverySlots: deliverySlots(s), delivery: { deliveryBaseFee, deliveryPerKm, deliveryMinFee, roadFactor, maxDeliveryKm } }
}

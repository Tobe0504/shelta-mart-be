import { badRequest, notFound } from "../../lib/errors.ts"
import { payPendingForStore } from "../orders/order.service.ts"
import { getSettings } from "../settings/setting.service.ts"
import * as paystack from "../../lib/paystack.ts"
import { uniqueSlug } from "../../lib/slugify.ts"
import { PUBLIC_STORE, StoreModel } from "./store.model.ts"
import type { PayoutInput, UpdateStoreInput } from "./store.schema.ts"

export const createStoreFor = (owner: string, name: string) => StoreModel.create({ owner, name, slug: uniqueSlug(name) })

export async function getPublicStore(slug: string) {
  const store = await StoreModel.findOne({ slug }).select(PUBLIC_STORE)
  if (!store) throw notFound("Store")
  return store
}

/** The signed-in seller's store. */
export async function getOwnStore(owner: string) {
  const store = await StoreModel.findOne({ owner })
  if (!store) throw notFound("Store")
  return store
}

export async function updateOwnStore(owner: string, input: UpdateStoreInput) {
  const store = await getOwnStore(owner)
  if (input.offloadFee !== undefined) {
    const { offloadFee: minimum } = await getSettings()
    if (input.offloadFee < minimum) throw badRequest(`Offloading can’t be less than ₦${minimum.toLocaleString("en-NG")}, SheltaMart’s minimum`)
  }
  store.set(input)
  return store.save()
}

/** Verifies the bank account with Paystack and registers it for payouts. */
export async function setPayout(owner: string, { bankCode, bankName, accountNumber }: PayoutInput) {
  const store = await getOwnStore(owner)
  const { accountName } = await paystack.resolveAccount(accountNumber, bankCode)
  const { recipientCode } = await paystack.createRecipient({ name: accountName, accountNumber, bankCode })
  store.payout = { bankCode, bankName, accountNumber, accountName, recipientCode }
  await store.save()
  // Anything held back for want of an account goes out now.
  await payPendingForStore(store._id)
  return store
}

export const resolveAccount = (accountNumber: string, bankCode: string) => paystack.resolveAccount(accountNumber, bankCode)
export const listBanks = () => paystack.listBanks()

export async function setVerified(id: string, verified: boolean) {
  const store = await StoreModel.findByIdAndUpdate(id, { verified }, { new: true })
  if (!store) throw notFound("Store")
  return store
}

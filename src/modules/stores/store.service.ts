import { notFound } from "../../lib/errors.ts"
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
  store.set(input)
  return store.save()
}

/** Verifies the bank account with Paystack and registers it for payouts. */
export async function setPayout(owner: string, { bankCode, bankName, accountNumber }: PayoutInput) {
  const store = await getOwnStore(owner)
  const { accountName } = await paystack.resolveAccount(accountNumber, bankCode)
  const { recipientCode } = await paystack.createRecipient({ name: accountName, accountNumber, bankCode })
  store.payout = { bankCode, bankName, accountNumber, accountName, recipientCode }
  return store.save()
}

export const resolveAccount = (accountNumber: string, bankCode: string) => paystack.resolveAccount(accountNumber, bankCode)
export const listBanks = () => paystack.listBanks()

export async function setVerified(id: string, verified: boolean) {
  const store = await StoreModel.findByIdAndUpdate(id, { verified }, { new: true })
  if (!store) throw notFound("Store")
  return store
}

import bcrypt from "bcryptjs"
import { badRequest, notFound } from "../../lib/errors.ts"
import { ProductModel } from "../products/product.model.ts"
import { UserModel } from "./user.model.ts"
import type { ChangePasswordInput, UpdateProfileInput } from "./user.schema.ts"

async function findUser(id: string) {
  const user = await UserModel.findById(id)
  if (!user) throw notFound("User")
  return user
}

export const getProfile = findUser

export async function updateProfile(id: string, input: UpdateProfileInput) {
  const user = await findUser(id)
  const { notify, avatar, ...rest } = input
  user.set(rest)
  if (avatar !== undefined) user.avatar = avatar ?? undefined
  if (notify) user.set({ notify: { ...user.notify, ...notify } })
  return user.save()
}

export async function changePassword(id: string, { current, next }: ChangePasswordInput) {
  const user = await UserModel.findById(id).select("+passwordHash +tokenVersion")
  if (!user) throw notFound("User")
  if (!(await bcrypt.compare(current, user.passwordHash))) throw badRequest("Your current password is incorrect")
  user.passwordHash = await bcrypt.hash(next, 12)
  user.tokenVersion += 1
  return user.save()
}

export async function listSaved(id: string) {
  const user = await UserModel.findById(id).populate({ path: "saved", match: { status: "live" }, populate: { path: "store", select: "name slug area verified" } })
  if (!user) throw notFound("User")
  return user.saved
}

export async function setSaved(id: string, productId: string, saved: boolean) {
  if (saved && !(await ProductModel.exists({ _id: productId }))) throw notFound("Product")
  await UserModel.updateOne({ _id: id }, saved ? { $addToSet: { saved: productId } } : { $pull: { saved: productId } })
  return listSaved(id)
}

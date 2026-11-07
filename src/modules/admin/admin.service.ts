import type { QueryFilter } from "mongoose"
import { paged, skip } from "../../lib/paginate.ts"
import { contains } from "../../lib/regex.ts"
import { EnquiryModel } from "../enquiries/enquiry.model.ts"
import { JobModel } from "../jobs/job.model.ts"
import { OrderModel } from "../orders/order.model.ts"
import { ProductModel } from "../products/product.model.ts"
import { ProModel } from "../pros/pro.model.ts"
import { QuoteModel } from "../quotes/quote.model.ts"
import { StoreModel, type Store } from "../stores/store.model.ts"
import { UserModel } from "../users/user.model.ts"
import type { ListStoresInput } from "./admin.schema.ts"


/** Headline numbers and work queues for the admin dashboard. */
export async function overview() {
  const [sales, newQuotes, newEnquiries, unverifiedStores, buyers, liveProducts, payouts, unverifiedPros, escrow, goodsHeld] = await Promise.all([
    OrderModel.aggregate<{ orders: number; gmv: number; commission: number }>([
      { $match: { "payment.status": "paid" } },
      { $group: { _id: null, orders: { $sum: 1 }, gmv: { $sum: "$total" }, commission: { $sum: { $sum: "$shipments.commission" } } } },
    ]),
    QuoteModel.countDocuments({ status: "new" }),
    EnquiryModel.countDocuments({ status: "new", topic: "estate" }),
    StoreModel.countDocuments({ verified: false }),
    UserModel.countDocuments({ role: "buyer" }),
    ProductModel.countDocuments({ status: "live" }),
    OrderModel.aggregate<{ count: number; amount: number }>([
      { $unwind: "$shipments" },
      { $match: { "shipments.payoutStatus": { $in: ["pending", "failed"] } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$shipments.payout" } } },
    ]),
    ProModel.countDocuments({ verified: false, active: true }),
    JobModel.aggregate<{ held: number; heldCount: number; issues: number; commission: number; payoutCount: number; payoutAmount: number }>([
      { $unwind: "$stages" },
      {
        $group: {
          _id: null,
          held: { $sum: { $cond: [{ $eq: ["$stages.status", "held"] }, "$stages.amount", 0] } },
          heldCount: { $sum: { $cond: [{ $eq: ["$stages.status", "held"] }, 1, 0] } },
          issues: { $sum: { $cond: [{ $and: [{ $eq: ["$stages.status", "held"] }, { $ifNull: ["$stages.issue.at", false] }] }, 1, 0] } },
          commission: { $sum: { $ifNull: ["$stages.commission", 0] } },
          payoutCount: { $sum: { $cond: [{ $in: ["$stages.payoutStatus", ["pending", "failed"]] }, 1, 0] } },
          payoutAmount: { $sum: { $cond: [{ $in: ["$stages.payoutStatus", ["pending", "failed"]] }, "$stages.payout", 0] } },
        },
      },
    ]),
    OrderModel.aggregate<{ amount: number; count: number; issues: number }>([
      { $match: { "payment.status": "paid" } },
      { $unwind: "$shipments" },
      { $match: { "shipments.status": { $in: ["placed", "confirmed", "loaded", "on_the_way"] } } },
      { $group: { _id: null, amount: { $sum: "$shipments.amount" }, count: { $sum: 1 }, issues: { $sum: { $cond: [{ $ifNull: ["$shipments.issue.at", false] }, 1, 0] } } } },
    ]),
  ])
  const e = escrow[0]
  const g = goodsHeld[0]
  return {
    orders: sales[0]?.orders ?? 0,
    gmv: sales[0]?.gmv ?? 0,
    commission: (sales[0]?.commission ?? 0) + (e?.commission ?? 0),
    pendingPayouts: { count: (payouts[0]?.count ?? 0) + (e?.payoutCount ?? 0), amount: (payouts[0]?.amount ?? 0) + (e?.payoutAmount ?? 0) },
    escrow: { amount: (e?.held ?? 0) + (g?.amount ?? 0), count: (e?.heldCount ?? 0) + (g?.count ?? 0), issues: (e?.issues ?? 0) + (g?.issues ?? 0) },
    newQuotes,
    newEnquiries,
    unverifiedStores,
    unverifiedPros,
    buyers,
    liveProducts,
  }
}

/** Every store with its owner's contact details and product count, unverified first. */
export async function listStores({ q, verified, ...page }: ListStoresInput) {
  const filter: QueryFilter<Store> = { ...(verified !== undefined && { verified }), ...(q && { name: contains(q) }) }
  const [stores, total] = await Promise.all([
    StoreModel.find(filter).sort({ verified: 1, createdAt: -1 }).skip(skip(page)).limit(page.limit).select("-payout.recipientCode -payout.accountNumber").populate("owner", "name email phone"),
    StoreModel.countDocuments(filter),
  ])
  const counts = await ProductModel.aggregate<{ _id: unknown; count: number }>([{ $match: { store: { $in: stores.map((s) => s._id) } } }, { $group: { _id: "$store", count: { $sum: 1 } } }])
  const items = stores.map((s) => ({ ...s.toJSON(), productCount: counts.find((c) => String(c._id) === s.id)?.count ?? 0, hasPayout: Boolean(s.payout?.bankCode) }))
  return paged(items, total, page)
}

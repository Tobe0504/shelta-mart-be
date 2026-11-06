import type { QueryFilter, Types } from "mongoose";
import { notFound } from "../../lib/errors.ts";
import * as paystack from "../../lib/paystack.ts";
import type { PayoutInput } from "../stores/store.schema.ts";
import { hasCoords, haversineKm } from "../../lib/geo.ts";
import { paged, skip } from "../../lib/paginate.ts";
import { contains } from "../../lib/regex.ts";
import { uniqueSlug } from "../../lib/slugify.ts";
import { CategoryModel } from "../catalog/catalog.model.ts";
import { assertTrades } from "../catalog/catalog.service.ts";
import { ProModel, PUBLIC_PRO, ReviewModel, type Pro } from "./pro.model.ts";
import type {
  AdminListProsInput,
  AdminUpdateProInput,
  ListProsInput,
  ProProfileInput,
} from "./pro.schema.ts";

/** Most pros considered for a location search before paging. */
const NEARBY_POOL = 500;
const RANKINGS = {
  best: { verified: -1, rating: -1, reviewCount: -1 },
  rating: { rating: -1, reviewCount: -1 },
  jobs: { jobsDone: -1, rating: -1 },
  nearest: { verified: -1, rating: -1 },
} as const;

/** Trade slugs whose name matches the search, so "plumb" finds plumbers by trade as well as by name. */
const tradesMatching = (q: string) =>
  CategoryModel.find({ name: contains(q) }).distinct("slug");

/**
 * Active pros, filtered by trade, search text and verification. With `lat,lng`, only pros whose
 * service radius covers that point, each with its distance (and `nearest` sorts by it).
 */
export async function listPros({
  trade,
  q,
  verified,
  sort,
  lat,
  lng,
  ...page
}: ListProsInput) {
  const textTrades = q ? await tradesMatching(q) : [];
  const filter: QueryFilter<Pro> = {
    active: true,
    ...(trade && { trades: trade }),
    ...(verified && { verified: true }),
    ...(q && {
      $or: [
        { name: contains(q) },
        { headline: contains(q) },
        { location: contains(q) },
        { trades: { $in: textTrades } },
      ],
    }),
  };
  const ranking = RANKINGS[sort];
  const at = { lat, lng };
  if (!hasCoords(at)) {
    const [items, total] = await Promise.all([
      ProModel.find(filter)
        .select(PUBLIC_PRO)
        .sort(ranking)
        .skip(skip(page))
        .limit(page.limit)
        .lean(),
      ProModel.countDocuments(filter),
    ]);
    return paged(items.map(withId), total, page);
  }
  const pool = await ProModel.find(filter)
    .select(PUBLIC_PRO)
    .sort(ranking)
    .limit(NEARBY_POOL)
    .lean();
  const covering = pool
    .map((p) => ({
      ...withId(p),
      distanceKm: hasCoords(p.coords)
        ? Math.round(haversineKm(at, p.coords) * 10) / 10
        : null,
    }))
    .filter(
      (p): p is typeof p & { distanceKm: number } =>
        p.distanceKm !== null && p.distanceKm <= p.radiusKm,
    );
  if (sort === "nearest") covering.sort((a, b) => a.distanceKm - b.distanceKm);
  return paged(
    covering.slice(skip(page), skip(page) + page.limit),
    covering.length,
    page,
  );
}

const withId = <T extends { _id: unknown }>({ _id, ...rest }: T) => ({
  id: String(_id),
  ...rest,
});

/** How many active pros offer each trade, keyed by trade slug. */
export async function tradeCounts() {
  const rows = await ProModel.aggregate<{ _id: string; count: number }>([
    { $match: { active: true } },
    { $unwind: "$trades" },
    { $group: { _id: "$trades", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

export async function getPublicPro(slug: string) {
  const pro = await ProModel.findOne({ slug, active: true }).select(PUBLIC_PRO);
  if (!pro) throw notFound("Pro");
  const reviews = await ReviewModel.find({ pro: pro._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("name rating text createdAt");
  return { ...pro.toJSON(), reviews };
}

/** The signed-in user's pro profile, or null if they haven't made one. */
export const getOwnPro = (owner: string) => ProModel.findOne({ owner });

export async function requireOwnPro(owner: string) {
  const pro = await getOwnPro(owner);
  if (!pro) throw notFound("Pro profile");
  return pro;
}

/** Creates or updates the signed-in user's pro profile. */
export async function saveOwnPro(owner: string, input: ProProfileInput) {
  await assertTrades(input.trades);
  const pro =
    (await getOwnPro(owner)) ??
    new ProModel({ owner, slug: uniqueSlug(input.name) });
  pro.set({
    ...input,
    rate: input.rate ?? undefined,
    photo: input.photo ?? undefined,
  });
  return pro.save();
}

/** Verifies the bank account with Paystack and registers it for escrow payouts. */
export async function setOwnPayout(
  owner: string,
  { bankCode, bankName, accountNumber }: PayoutInput,
) {
  const pro = await requireOwnPro(owner);
  const { accountName } = await paystack.resolveAccount(
    accountNumber,
    bankCode,
  );
  const { recipientCode } = await paystack.createRecipient({
    name: accountName,
    accountNumber,
    bankCode,
  });
  pro.payout = {
    bankCode,
    bankName,
    accountNumber,
    accountName,
    recipientCode,
  };
  return pro.save();
}

/** Adds a buyer's review and folds it into the pro's running average. */
export async function addReview(input: {
  pro: Types.ObjectId;
  job: Types.ObjectId;
  user: string;
  name: string;
  rating: number;
  text?: string;
}) {
  await ReviewModel.create(input);
  const pro = await ProModel.findById(input.pro).orFail();
  const count = pro.reviewCount + 1;
  pro.set({
    reviewCount: count,
    rating:
      Math.round(((pro.rating * pro.reviewCount + input.rating) / count) * 10) /
      10,
  });
  await pro.save();
}

export async function adminListPros({
  verified,
  q,
  ...page
}: AdminListProsInput) {
  const filter: QueryFilter<Pro> = {
    ...(verified !== undefined && { verified }),
    ...(q && { name: contains(q) }),
  };
  const [items, total] = await Promise.all([
    ProModel.find(filter)
      .sort({ verified: 1, createdAt: -1 })
      .skip(skip(page))
      .limit(page.limit)
      .populate("owner", "name email"),
    ProModel.countDocuments(filter),
  ]);
  return paged(items, total, page);
}

export async function adminUpdatePro(id: string, input: AdminUpdateProInput) {
  const pro = await ProModel.findByIdAndUpdate(id, input, { new: true });
  if (!pro) throw notFound("Pro");
  return pro;
}

/**
 * Loads the sample catalogue (exported from the frontend prototype) and demo accounts.
 * Safe to re-run: records are upserted by slug or email.
 *
 *   npm run seed
 */
import bcrypt from "bcryptjs"
import { readFileSync } from "node:fs"
import { connectDb, disconnectDb } from "../src/config/db.ts"
import { logger } from "../src/lib/logger.ts"
import { AreaModel } from "../src/modules/areas/area.model.ts"
import { CategoryModel, DepartmentModel } from "../src/modules/catalog/catalog.model.ts"
import { EstateModel } from "../src/modules/estates/estate.model.ts"
import { ProductModel } from "../src/modules/products/product.model.ts"
import { PromoModel } from "../src/modules/promos/promo.model.ts"
import { ProModel } from "../src/modules/pros/pro.model.ts"
import { getSettings } from "../src/modules/settings/setting.service.ts"
import { SiteModel } from "../src/modules/sites/site.model.ts"
import { StoreModel } from "../src/modules/stores/store.model.ts"
import { UserModel } from "../src/modules/users/user.model.ts"

type Seed = {
  departments: { slug: string; name: string }[]
  categories: { slug: string; name: string; tone: string; department: string }[]
  sellers: { id: string; name: string; area: string; verified: boolean; replyTime: string }[]
  areas: { id: string; city: string; name: string; deliveryFee: number }[]
  products: { slug: string; sellerId: string; reviews: number; stock: number; [key: string]: unknown }[]
  estates: { id: string; [key: string]: unknown }[]
  promos: { id: string; [key: string]: unknown }[]
  serviceDepartments: { slug: string; name: string }[]
  trades: { slug: string; name: string; tone: string; department: string }[]
  pros: { id: string; name: string; rate: { amount: number; unit: string } | null; [key: string]: unknown }[]
}

const data: Seed = JSON.parse(readFileSync(new URL("./data/seed.json", import.meta.url), "utf8"))
/** Shared password for every demo account. Development only. */
const DEMO_PASSWORD = "Password123!"
const DEMO_SELLER_STORE = "okafor"
const DEMO_PRO = "tunde"

/** Warehouse points for the sample stores, by the area name in the seed data. */
const warehouses: Record<string, { address: string; location: string; coords: { lat: number; lng: number } }> = {
  Ikeja: { address: "Obafemi Awolowo Way, Ikeja", location: "Ikeja, Lagos", coords: { lat: 6.6018, lng: 3.3515 } },
  Ogba: { address: "Ogba Industrial Estate", location: "Ogba, Ikeja", coords: { lat: 6.628, lng: 3.3406 } },
  Agege: { address: "Agege Motor Road", location: "Agege, Lagos", coords: { lat: 6.6181, lng: 3.3209 } },
  Ikorodu: { address: "Ikorodu–Sagamu Road", location: "Ikorodu, Lagos", coords: { lat: 6.6194, lng: 3.5105 } },
  Ojota: { address: "Ikorodu Road, Ojota", location: "Ojota, Lagos", coords: { lat: 6.5864, lng: 3.3816 } },
  Lekki: { address: "Admiralty Way, Lekki Phase 1", location: "Lekki, Lagos", coords: { lat: 6.4474, lng: 3.4723 } },
  Oregun: { address: "Kudirat Abiola Way, Oregun", location: "Oregun, Ikeja", coords: { lat: 6.6, lng: 3.36 } },
}

const upsert = <T>(model: { updateOne: (filter: object, update: object, options: object) => Promise<unknown> }, filter: object, doc: T) =>
  model.updateOne(filter, { $set: doc }, { upsert: true })

async function seedUser(email: string, name: string, role: "buyer" | "seller" | "admin", passwordHash: string, phone?: string) {
  await UserModel.updateOne({ email }, { $set: { name, role, phone }, $setOnInsert: { passwordHash } }, { upsert: true })
  return UserModel.findOne({ email }).orFail()
}

async function main() {
  await connectDb()
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  await getSettings()
  await Promise.all(data.departments.map((d, order) => upsert(DepartmentModel, { slug: d.slug }, { ...d, kind: "products", order })))
  await Promise.all(data.categories.map((c, order) => upsert(CategoryModel, { slug: c.slug }, { ...c, order })))
  await Promise.all(data.serviceDepartments.map((d, order) => upsert(DepartmentModel, { slug: d.slug }, { ...d, kind: "services", order })))
  await Promise.all(data.trades.map((c, order) => upsert(CategoryModel, { slug: c.slug }, { ...c, order })))
  await Promise.all(data.areas.map(({ id, ...a }) => upsert(AreaModel, { slug: id }, { ...a, slug: id, active: true })))

  const buyer = await seedUser("buyer@example.com", "Chiamaka Obi", "buyer", passwordHash, "0803 000 0001")
  await seedUser("admin@example.com", "SheltaMart Admin", "admin", passwordHash)
  const areaOf = (name: string) => data.areas.find((a) => a.name === name)

  const stores = new Map<string, string>()
  for (const s of data.sellers) {
    const owner =
      s.id === DEMO_SELLER_STORE
        ? await seedUser("seller@example.com", "Emeka Okafor", "seller", passwordHash, "0803 000 0002")
        : await seedUser(`${s.id}@sellers.example.com`, s.name, "seller", passwordHash)
    await upsert(StoreModel, { slug: s.id }, { owner: owner._id, slug: s.id, name: s.name, area: areaOf(s.area)?.id, location: s.area, ...warehouses[s.area], verified: s.verified, replyTime: s.replyTime })
    stores.set(s.id, String((await StoreModel.findOne({ slug: s.id }).orFail())._id))
  }

  for (const { sellerId, reviews, ...p } of data.products) {
    const status = p.stock > 0 ? "live" : "out-of-stock"
    await upsert(ProductModel, { slug: p.slug }, { ...p, store: stores.get(sellerId), reviewCount: reviews, status })
  }

  await Promise.all(data.estates.map(({ id, ...e }) => upsert(EstateModel, { slug: id }, { ...e, slug: id, active: true })))

  await PromoModel.deleteMany({})
  await PromoModel.insertMany(data.promos.map(({ id: _id, ...p }, order) => ({ ...p, order })))

  for (const { id, rate, ...p } of data.pros) {
    const owner = id === DEMO_PRO ? await seedUser("pro@example.com", p.name, "buyer", passwordHash, "0803 000 0003") : await seedUser(`${id}@pros.example.com`, p.name, "buyer", passwordHash)
    await upsert(ProModel, { slug: id }, { ...p, ...(rate && { rate }), slug: id, owner: owner._id, phone: owner.phone ?? "0803 000 0099", active: true })
  }

  await upsert(SiteModel, { user: buyer._id, label: "Allen Avenue site" }, {
    user: buyer._id,
    label: "Allen Avenue site",
    address: "14 Allen Avenue, Ikeja, Lagos",
    area: "Oregun, Ikeja",
    coords: { lat: 6.6015, lng: 3.3521 },
    contactName: "Emeka",
    contactPhone: "0803 000 0000",
  })

  logger.info(
    { departments: data.departments.length, categories: data.categories.length, stores: stores.size, products: data.products.length, estates: data.estates.length, promos: data.promos.length, trades: data.trades.length, pros: data.pros.length },
    `Seeded. Demo accounts use the password ${DEMO_PASSWORD}`,
  )
}

main()
  .catch((err) => {
    logger.error(err)
    process.exitCode = 1
  })
  .finally(disconnectDb)

# SheltaMart v2 API

Express 5 + TypeScript + MongoDB (Mongoose). Zod validates every request. Auth is JWT in httpOnly cookies, payments go through Paystack and uploads through Cloudinary.

## Getting started

```bash
cp .env.example .env    # then fill in the values
npm install
npm run seed            # sample catalogue + demo accounts (safe to re-run)
npm run dev             # http://localhost:4000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with reload on change |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` / `npm run lint` | Type-check and lint |
| `npm run seed` | Load `scripts/data/seed.json` and the demo accounts |

**Demo accounts** (password `Password123!`, development only):
- buyer@example.com
- seller@example.com (owns Okafor Building Supplies)
- admin@example.com

The other sample stores use `<store-id>@sellers.example.com`.

Leave `PAYSTACK_SECRET_KEY` empty to use the built-in payment simulator, so checkout works with no keys at all.

## Structure

```
src/
  server.ts            boot: connect to MongoDB, listen, graceful shutdown
  app.ts               middleware stack, /health, /api/v1, error handling
  routes.ts            mounts every module's router
  config/              env (validated with Zod), db connection
  lib/                 errors, tokens, validation helpers, pricing, paystack client, logger…
  middleware/          authenticate / requireAuth, error handler, rate limits
  modules/<name>/
    <name>.model.ts       Mongoose schema and model
    <name>.schema.ts      Zod input schemas and their types
    <name>.service.ts     business logic; the only layer that touches models
    <name>.controller.ts  parses input, calls the service, sends the response
    <name>.routes.ts      paths, auth guards and rate limits
scripts/seed.ts        idempotent seed
```

Conventions:
- **Layers:** routes → controller → service → model. A controller never queries the database, and a service never touches `req` or `res`.
- **Responses:** `{ data }`, and lists add `{ meta: { page, limit, total, pages } }`.
- **Errors:** `{ error: { code, message, details? } }`.
- **Throwing errors:** use the helpers in `lib/errors.ts`, such as `notFound("Product")`. Zod errors become `400 invalid_input` with field errors.
- **Defaults:** Zod schemas never set `.default()` on fields that a `.partial()` PATCH schema reuses. The Mongoose model owns those defaults, so a partial update can't overwrite fields it didn't send.
- **Money:** whole naira everywhere. It's converted to kobo only inside `lib/paystack.ts`.

## Fees are configurable

`GET/PATCH /admin/settings` holds:
- the default commission (5%) and per-category overrides;
- the offload fee and any service fee;
- delivery windows and how many days ahead they can be booked;
- the payout delay.

Each order stores the commission and payout worked out at checkout, so changing a rate never affects existing orders.

## Order flow

```
pending_payment → placed → confirmed → loaded → on_the_way → delivered
                    └──────────┴── cancelled (seller declines → refund)
```

1. **Checkout:** `POST /orders` prices the server-side cart per store, using bulk tiers, the area's delivery fee and the offload fee. It returns a Paystack `authorizationUrl`.
2. **Payment:** Paystack redirects to `CLIENT_URL/checkout/complete?reference=…`. That page calls `GET /payments/verify`. The webhook (`POST /payments/paystack/webhook`, signature-checked) also marks the order paid.
3. **Fulfilment:** the seller accepts, marks it loaded, then dispatches with driver details.
4. **Payout:** the buyer confirms delivery, then the seller is paid by Paystack transfer to the account set via `PUT /seller/store/payout`. With a payout delay, `POST /admin/payouts/run` (or a scheduled job) pays shipments once they're due.

## Endpoints (`/api/v1`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` `login` `refresh` `logout` `forgot-password` `reset-password` |
| Me | `GET/PATCH /me` · `PUT /me/password` · `GET /me/saved` · `PUT/DELETE /me/saved/:productId` |
| Catalogue | `GET /catalog` (departments with categories) · `GET /categories/:slug` · `GET /areas` · `GET /settings` |
| Products | `GET /products?q&category&brand&deals&sort&page&limit` · `GET /products/brands?category` · `GET /products/:slug` · `GET /products/:slug/related` |
| Stores | `GET /stores/:slug` |
| Cart | `GET /cart?area` · `PUT /cart/lines/:productId` · `POST /cart/merge` · `DELETE /cart` |
| Sites | `GET/POST /sites` · `PATCH/DELETE /sites/:id` |
| Orders | `POST/GET /orders` · `GET /orders/:number` · `POST /orders/:number/payment` (retry) · `POST /orders/:number/shipments/:id/confirm` `reschedule` `report` |
| Payments | `GET /payments/verify?reference` · `POST /payments/paystack/webhook` |
| Uploads | `POST /uploads/sign` `{ kind: avatar \| product \| estate \| quote }`: signed direct-to-Cloudinary upload |
| Quotes | `POST /quotes` · `GET /quotes` (mine) |
| Real estate | `GET /estates?kind&city` (with facets) · `GET /estates/:slug` |
| Enquiries | `POST /enquiries` `{ topic: product \| estate, target }` |
| Promos | `GET /promos?category` |
| Seller | `GET/PATCH /seller/store` · `PUT /seller/store/payout` · `GET /seller/banks` · `POST /seller/banks/resolve` · `GET/POST /seller/products` · `GET/PATCH/DELETE /seller/products/:slug` · `GET /seller/orders` · `POST /seller/orders/:number/shipments/:id/accept` `load` `dispatch` `decline` · `GET/PATCH /seller/enquiries` |
| Admin | `GET/PATCH /admin/settings` · `PUT /admin/departments` · `POST/PATCH/DELETE /admin/categories` · `PUT /admin/areas` · `PATCH /admin/stores/:id/verification` · `POST/PATCH /admin/estates` · `GET/POST/PATCH/DELETE /admin/promos` · `GET/PATCH /admin/quotes` · `GET/PATCH /admin/enquiries` · `POST /admin/payouts/run` |

## Frontend notes

- Proxy `/api` from Next.js to this server, so cookies stay on the same site and `COOKIE_SAME_SITE=lax` works. If the API lives on another domain, use `none` over HTTPS.
- The access token lasts 15 minutes. On a `401`, call `POST /auth/refresh` once and retry.
- Alongside the httpOnly auth cookies the API sets a readable `sm_session=1` cookie. It holds no secret; the frontend uses it to skip `/me` and refresh calls for signed-out visitors.

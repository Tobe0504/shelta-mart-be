import { Router } from "express"
import { adminRoutes } from "./modules/admin/admin.routes.ts"
import { areaRoutes } from "./modules/areas/area.routes.ts"
import { authRoutes } from "./modules/auth/auth.routes.ts"
import { cartRoutes } from "./modules/cart/cart.routes.ts"
import { catalogRoutes } from "./modules/catalog/catalog.routes.ts"
import { enquiryRoutes } from "./modules/enquiries/enquiry.routes.ts"
import { geoRoutes } from "./modules/geo/geo.routes.ts"
import { jobRoutes } from "./modules/jobs/job.routes.ts"
import { estateRoutes } from "./modules/estates/estate.routes.ts"
import { orderRoutes } from "./modules/orders/order.routes.ts"
import { paymentRoutes } from "./modules/payments/payment.routes.ts"
import { productRoutes } from "./modules/products/product.routes.ts"
import { promoRoutes } from "./modules/promos/promo.routes.ts"
import { proRoutes } from "./modules/pros/pro.routes.ts"
import { quoteRoutes } from "./modules/quotes/quote.routes.ts"
import { settingRoutes } from "./modules/settings/setting.routes.ts"
import { siteRoutes } from "./modules/sites/site.routes.ts"
import { storeRoutes } from "./modules/stores/store.routes.ts"
import { uploadRoutes } from "./modules/uploads/upload.routes.ts"
import { userRoutes } from "./modules/users/user.routes.ts"

/** Every module's routes, mounted under /api/v1. */
export const apiRoutes = Router().use(
  authRoutes,
  userRoutes,
  settingRoutes,
  catalogRoutes,
  areaRoutes,
  storeRoutes,
  productRoutes,
  cartRoutes,
  siteRoutes,
  orderRoutes,
  paymentRoutes,
  uploadRoutes,
  quoteRoutes,
  estateRoutes,
  enquiryRoutes,
  proRoutes,
  jobRoutes,
  promoRoutes,
  adminRoutes,
  geoRoutes,
)

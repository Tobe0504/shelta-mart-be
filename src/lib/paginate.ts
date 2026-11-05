import type { Pagination } from "./validation.ts"

export const skip = ({ page, limit }: Pagination) => (page - 1) * limit

/** `{ data, meta }` envelope for list endpoints. */
export const paged = <T>(data: T[], total: number, { page, limit }: Pagination) => ({
  data,
  meta: { page, limit, total, pages: Math.ceil(total / limit) },
})

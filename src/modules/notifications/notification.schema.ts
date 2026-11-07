import { z } from "zod"
import { objectId } from "../../lib/validation.ts"

export const markReadSchema = z.object({ ids: z.array(objectId).max(100).optional() })
export type MarkReadInput = z.infer<typeof markReadSchema>

import { z } from 'zod'
import { CLAIM_STATUSES } from '@/lib/types/warranty'

export const claimRaiseSchema = z.object({
  description: z.string().min(1).max(1000),
  photoURLs: z.array(z.string().url()).max(6),
})

export const claimUpdateSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  adminNotes: z.string().max(500).nullable(),
})

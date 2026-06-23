import { z } from 'zod'

export const priceEditSchema = z.object({
  serviceId: z.string().min(1),
  modelId: z.string().min(1),
  variant: z.string().min(1).nullable(),
  amount: z.number().int().nonnegative(),
  available: z.boolean(),
})
export type PriceEdit = z.infer<typeof priceEditSchema>

export const serviceInputSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(2000),
  active: z.boolean(),
})
export type ServiceInput = z.infer<typeof serviceInputSchema>

export const serviceImageSchema = z.object({
  id: z.string().min(1),
  imageURL: z.string().url(),
})

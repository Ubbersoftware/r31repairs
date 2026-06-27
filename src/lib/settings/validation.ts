import { z } from 'zod'

const paymentChannelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  payToLabel: z.string().min(1),
  details: z.string().min(1),
})

export const settingsInputSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(200),
  mapURL: z.string().max(300),
  phone: z.string().max(30),
  instagram: z.string().max(60),
  logoURL: z.string().url().nullable(),
  paymentChannels: z.array(paymentChannelSchema).min(1).max(10),
  warrantyMonths: z.number().int().min(1).max(24),
})

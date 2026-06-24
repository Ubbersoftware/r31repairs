import { z } from 'zod'
import { ORDER_STATUSES } from '@/lib/types/order'

export const bookingItemSchema = z.object({
  itemId: z.string().min(1),
  serviceId: z.string().min(1),
  variant: z.string().min(1).nullable().default(null),
})

export const bookingDeviceSchema = z.object({
  deviceId: z.string().min(1),
  phoneModelId: z.string().min(1),
  label: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(bookingItemSchema).min(1),
})

export const bookingSchema = z.object({ devices: z.array(bookingDeviceSchema).min(1) })
export type BookingInput = z.infer<typeof bookingSchema>

const statusEnum = z.enum(ORDER_STATUSES)
export const statusChangeSchema = z.object({ toStatus: statusEnum, note: z.string().max(1000).optional() })

export const lineEditSchema = z.object({
  itemId: z.string().min(1),
  finalAmount: z.number().int().nonnegative(),
  note: z.string().max(1000).optional(),
})

export const noteSchema = z.object({ note: z.string().min(1).max(1000) })

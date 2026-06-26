import { z } from 'zod'

export const discountSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('amount'), value: z.number().int().nonnegative() }),
  z.object({ type: z.literal('percent'), value: z.number().int().min(0).max(100) }),
]).nullable()

export const lineItemSchema = z.object({
  lineId: z.string().min(1),
  description: z.string().min(1).max(200),
  sourceItemId: z.string().min(1).nullable(),
  amount: z.number().int().nonnegative(),
})

export const updateInvoiceSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1),
  discount: discountSchema,
})
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>

export const proofSchema = z.object({
  paymentMethod: z.enum(['bank_transfer', 'orange_money', 'myzaka', 'pay2cell']),
  proofURL: z.string().url(),
})
export type ProofInput = z.infer<typeof proofSchema>

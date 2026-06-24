'use server'
import { revalidatePath } from 'next/cache'
import { verifyUser, getAdminDb } from '@/lib/firebase/admin'
import { nextOrderNumber } from '@/lib/orders/orderNumber'
import { bookingSchema, type BookingInput } from '@/lib/orders/validation'
import { getPriceMatrix, getActiveServices, getActiveModels } from '@/lib/catalog/queries'
import { priceFor } from '@/lib/catalog/pricing'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'

export async function createOrderAction(
  idToken: string,
  input: BookingInput,
): Promise<ActionResult & { orderId?: string }> {
  // DIAGNOSTIC STUB — if this message appears in the UI the action dispatch works
  // and the problem is in the function body. Remove after debugging.
  return { ok: false, error: 'INVALID', message: 'DIAGNOSTIC: action was reached, idToken length=' + idToken.length + ' devices=' + input.devices.length }
}

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
  let user
  try {
    user = await verifyUser(idToken)
  } catch (e) {
    return fail(e)
  }

  // BINARY SEARCH STEP 1: only run schema parse + catalog queries (no writes)
  try {
    const parsed = bookingSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'INVALID', message: 'schema: ' + JSON.stringify(parsed.error.flatten()) }
    }

    const [matrix, services, models] = await Promise.all([
      getPriceMatrix(),
      getActiveServices(),
      getActiveModels(),
    ])

    return {
      ok: false,
      error: 'INVALID',
      message: `STEP1_OK: user=${user.uid.slice(0,6)} svc_count=${services.length} mdl_count=${models.length} matrix_count=${matrix.length}`,
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return { ok: false, error: 'INVALID', message: `STEP1_CATCH: ${msg}` }
  }
}

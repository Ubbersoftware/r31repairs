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
    const svc = new Map(services.map((s) => [s.id, s]))
    const mdl = new Map(models.map((m) => [m.id, m]))

    const db = getAdminDb()
    const orderRef = db.collection('r31_orders').doc()
    const devices: Record<string, unknown>[] = []
    const items: Record<string, unknown>[] = []
    let estimatedTotal = 0

    for (const d of parsed.data.devices) {
      const model = mdl.get(d.phoneModelId)
      if (!model) return { ok: false, error: 'INVALID', message: `unknown model ${d.phoneModelId}` }
      devices.push({
        deviceId: d.deviceId,
        phoneModelId: d.phoneModelId,
        modelName: model.name,
        label: d.label ?? null,
        notes: d.notes ?? null,
      })
      for (const it of d.items) {
        const service = svc.get(it.serviceId)
        if (!service) return { ok: false, error: 'INVALID', message: `unknown service ${it.serviceId}` }
        const amount = priceFor(matrix, it.serviceId, d.phoneModelId, it.variant)
        if (amount == null) {
          return { ok: false, error: 'INVALID', message: `price unavailable: svc=${it.serviceId} mdl=${d.phoneModelId} v=${it.variant}` }
        }
        estimatedTotal += amount
        items.push({
          itemId: it.itemId,
          deviceId: d.deviceId,
          serviceId: it.serviceId,
          serviceName: service.name,
          variant: it.variant ?? null,
          quotedAmount: amount,
          lineStatus: 'placed',
        })
      }
    }

    const orderNumber = await nextOrderNumber(db)
    const now = Date.now()

    await orderRef.set({
      orderNumber,
      customerId: user.uid,
      customerName: (user as { name?: string }).name ?? '',
      customerPhone: (user as { phone_number?: string }).phone_number ?? '',
      status: 'placed',
      paymentStatus: 'unpaid',
      devices,
      items,
      estimatedTotal,
      createdAt: now,
      updatedAt: now,
    })

    await orderRef.collection('events').doc().set({
      type: 'created',
      toStatus: 'placed',
      visibility: 'customer',
      byUserId: user.uid,
      byRole: 'customer',
      at: now,
    })

    revalidatePath('/account')
    return { ok: true, orderId: orderRef.id }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return { ok: false, error: 'INVALID', message: `server error: ${msg}` }
  }
}

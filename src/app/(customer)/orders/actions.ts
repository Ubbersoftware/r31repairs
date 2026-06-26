'use server'
import { revalidatePath } from 'next/cache'
import { verifyUser, getAdminDb } from '@/lib/firebase/admin'
import { nextOrderNumber } from '@/lib/orders/orderNumber'
import { bookingSchema, type BookingInput } from '@/lib/orders/validation'
import { proofSchema } from '@/lib/invoices/validation'
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

  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID', message: 'bad booking' }

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
      // Recompute price server-side from live matrix — never trust any client-sent price
      const amount = priceFor(matrix, it.serviceId, d.phoneModelId, it.variant)
      if (amount == null) return { ok: false, error: 'INVALID', message: 'price unavailable' }
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
}

export async function submitProofOfPaymentAction(
  idToken: string,
  invoiceId: string,
  paymentMethod: string,
  proofURL: string,
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyUser(idToken)).uid } catch (e) { return fail(e) }
  const parsed = proofSchema.safeParse({ paymentMethod, proofURL })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      if (inv.customerId !== uid) throw new Error('FORBIDDEN')
      if (inv.status !== 'issued') throw new Error('INVALID')
      orderId = inv.orderId
      const now = Date.now()
      tx.update(ref, {
        status: 'payment_submitted',
        paymentMethod: parsed.data.paymentMethod,
        proofOfPaymentURL: parsed.data.proofURL,
        proofUploadedAt: now,
        updatedAt: now,
      })
      tx.update(db.collection('r31_orders').doc(inv.orderId), {
        paymentStatus: 'payment_submitted',
        updatedAt: now,
      })
    })
  } catch (e) { return fail(e) }
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
  revalidatePath('/admin/invoices')
  return { ok: true }
}

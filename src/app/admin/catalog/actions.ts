'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { priceId } from '@/lib/catalog/ids'
import { priceEditSchema, serviceInputSchema, serviceImageSchema, type PriceEdit } from '@/lib/catalog/validation'
import { z } from 'zod'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'

export type { ActionResult } from '@/lib/catalog/actionResult'

function revalidateCatalog() {
  revalidatePath('/')
  revalidatePath('/services')
  revalidatePath('/services/[slug]', 'page')
  revalidatePath('/book')
}

export async function savePricesAction(idToken: string, edits: PriceEdit[]): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = z.array(priceEditSchema).safeParse(edits)
  if (!parsed.success) return { ok: false, error: 'INVALID', message: 'bad price edits' }
  const db = getAdminDb()
  const batch = db.batch()
  for (const e of parsed.data) {
    const ref = db.collection('r31_prices').doc(priceId(e.serviceId, e.modelId, e.variant))
    batch.set(ref, { ...e, updatedAt: Date.now(), updatedBy: uid }, { merge: true })
  }
  await batch.commit()
  revalidateCatalog()
  return { ok: true }
}

export async function saveServiceAction(
  idToken: string, input: { id: string; description: string; active: boolean },
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = serviceInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('r31_services').doc(parsed.data.id).set(
    { description: parsed.data.description, active: parsed.data.active, updatedAt: Date.now(), updatedBy: uid },
    { merge: true },
  )
  revalidateCatalog()
  return { ok: true }
}

export async function setServiceImageAction(
  idToken: string, input: { id: string; imageURL: string },
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = serviceImageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('r31_services').doc(parsed.data.id).set({ imageURL: parsed.data.imageURL, updatedAt: Date.now(), updatedBy: uid }, { merge: true })
  revalidateCatalog()
  return { ok: true }
}

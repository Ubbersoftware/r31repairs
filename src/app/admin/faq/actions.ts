'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { faqInputSchema, type FaqInput } from '@/lib/catalog/validation'
import type { ActionResult } from '@/app/admin/catalog/actions'

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : 'INVALID'
  if (msg === 'UNAUTHENTICATED' || msg === 'FORBIDDEN') return { ok: false, error: msg }
  return { ok: false, error: 'INVALID', message: msg }
}

export async function saveFaqAction(idToken: string, input: FaqInput): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const parsed = faqInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const { id, ...data } = parsed.data
  const ref = id ? db.collection('faqs').doc(id) : db.collection('faqs').doc()
  await ref.set({ ...data, category: data.category ?? 'general' })
  revalidatePath('/faq')
  return { ok: true }
}

export async function deleteFaqAction(idToken: string, id: string): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  if (!id) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('faqs').doc(id).delete()
  revalidatePath('/faq')
  return { ok: true }
}

export async function reorderFaqAction(idToken: string, orderedIds: string[]): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const db = getAdminDb()
  const batch = db.batch()
  orderedIds.forEach((id, i) => batch.update(db.collection('faqs').doc(id), { sortOrder: i + 1 }))
  await batch.commit()
  revalidatePath('/faq')
  return { ok: true }
}

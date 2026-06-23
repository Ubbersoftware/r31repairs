'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { faqInputSchema, type FaqInput } from '@/lib/catalog/validation'
import { fail } from '@/lib/catalog/actionResult'
import type { ActionResult } from '@/lib/catalog/actionResult'

function revalidateFaq() {
  revalidatePath('/')
  revalidatePath('/faq')
}

export async function saveFaqAction(idToken: string, input: FaqInput): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const parsed = faqInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const { id, ...data } = parsed.data
  const ref = id ? db.collection('r31_faqs').doc(id) : db.collection('r31_faqs').doc()
  await ref.set({ ...data })
  revalidateFaq()
  return { ok: true }
}

export async function deleteFaqAction(idToken: string, id: string): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  if (!id) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('r31_faqs').doc(id).delete()
  revalidateFaq()
  return { ok: true }
}

export async function reorderFaqAction(idToken: string, orderedIds: string[]): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const db = getAdminDb()
  const batch = db.batch()
  orderedIds.forEach((id, i) => batch.update(db.collection('r31_faqs').doc(id), { sortOrder: i + 1 }))
  await batch.commit()
  revalidateFaq()
  return { ok: true }
}

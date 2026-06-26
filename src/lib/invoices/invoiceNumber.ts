import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'

export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(4, '0')}`
}

export async function nextInvoiceNumber(db: Firestore): Promise<string> {
  const ref = db.collection('r31_counters').doc('invoices')
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.exists ? (snap.data()!.seq as number) : 0) ?? 0) + 1
    tx.set(ref, { seq: next }, { merge: true })
    return next
  })
  return formatInvoiceNumber(seq)
}

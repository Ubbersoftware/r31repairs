import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'

export function formatOrderNumber(seq: number): string {
  return `R31-${String(seq).padStart(4, '0')}`
}

export async function nextOrderNumber(db: Firestore): Promise<string> {
  const ref = db.collection('r31_counters').doc('orders')
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.exists ? (snap.data()!.seq as number) : 0) ?? 0) + 1
    tx.set(ref, { seq: next }, { merge: true })
    return next
  })
  return formatOrderNumber(seq)
}

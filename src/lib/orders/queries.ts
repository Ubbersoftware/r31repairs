import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import { toOrder, toOrderEvent } from './mappers'
import type { Order, OrderEvent, OrderStatus } from '@/lib/types/order'

export async function getOrder(id: string): Promise<Order | null> {
  const doc = await getAdminDb().collection('r31_orders').doc(id).get()
  return doc.exists ? toOrder(doc.id, doc.data() as Record<string, unknown>) : null
}

export async function getOrdersForAdmin(opts: { status?: OrderStatus } = {}): Promise<Order[]> {
  let q = getAdminDb().collection('r31_orders') as FirebaseFirestore.Query
  if (opts.status) q = q.where('status', '==', opts.status)
  const snap = await q.get()
  return snap.docs.map((d) => toOrder(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const snap = await getAdminDb().collection('r31_orders').doc(orderId).collection('events').get()
  return snap.docs.map((d) => toOrderEvent(d.id, d.data())).sort((a, b) => a.at - b.at)
}

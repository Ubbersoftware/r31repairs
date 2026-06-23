'use client'
import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Order } from '@/lib/types/order'
import { OrderQueue } from './OrderQueue'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchOrders() {
      try {
        const q = query(collection(db, 'r31_orders'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        if (cancelled) return
        const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Order))
        setOrders(docs)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchOrders()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <p className="overline">Admin</p>
      <h1>Orders</h1>
      {loading && <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-5)' }}>Loading orders…</p>}
      {error && <p style={{ color: 'var(--danger)', marginTop: 'var(--space-5)' }}>Error: {error}</p>}
      {!loading && !error && <OrderQueue orders={orders} />}
    </>
  )
}

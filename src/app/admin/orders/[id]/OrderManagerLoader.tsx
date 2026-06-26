'use client'
import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Order, OrderEvent } from '@/lib/types/order'
import type { Invoice } from '@/lib/types/invoice'
import { toInvoice } from '@/lib/invoices/mappers'
import { OrderManager } from './OrderManager'

interface Props {
  id: string
}

export function OrderManagerLoader({ id }: Props) {
  const [order, setOrder] = useState<Order | null | 'not-found'>(null)
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const orderSnap = await getDoc(doc(db, 'r31_orders', id))
      if (!orderSnap.exists()) {
        setOrder('not-found')
        return
      }
      const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order
      setOrder(orderData)

      // Fetch invoice if one exists
      if (orderData.invoiceId) {
        const invSnap = await getDoc(doc(db, 'r31_invoices', orderData.invoiceId))
        setInvoice(invSnap.exists() ? toInvoice(invSnap.id, invSnap.data()) : null)
      } else {
        setInvoice(null)
      }

      // Unconstrained events query — owner may read ALL events incl. internal
      const eventsSnap = await getDocs(collection(db, 'r31_orders', id, 'events'))
      const eventsData = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderEvent))
      setEvents(eventsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-5)' }}>Loading order…</p>
  }

  if (error) {
    return <p role="alert" style={{ color: 'var(--danger)', marginTop: 'var(--space-5)' }}>Error: {error}</p>
  }

  if (order === 'not-found' || order === null) {
    return (
      <div style={{ marginTop: 'var(--space-5)' }}>
        <h1 style={{ color: 'var(--text-strong)' }}>Order not found</h1>
        <p style={{ color: 'var(--text-muted)' }}>The order you&apos;re looking for does not exist.</p>
      </div>
    )
  }

  return <OrderManager order={order} events={events} invoice={invoice} onChanged={fetchData} />
}

'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/lib/auth/useAuth'
import type { Order } from '@/lib/types/order'
import type { Invoice } from '@/lib/types/invoice'
import { toInvoice } from '@/lib/invoices/mappers'
import { StatusPill } from '@/components/orders/StatusPill'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { formatPula } from '@/lib/money'
import styles from './account.module.css'

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [queryLoading, setQueryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    setQueryLoading(true)
    setError(null)

    const ordersQ = query(
      collection(db, 'r31_orders'),
      where('customerId', '==', user.uid),
    )
    const invQ = query(
      collection(db, 'r31_invoices'),
      where('customerId', '==', user.uid),
    )

    Promise.all([getDocs(ordersQ), getDocs(invQ)])
      .then(([orderSnap, invSnap]) => {
        const rows: Order[] = orderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
        // Newest first
        rows.sort((a, b) => b.createdAt - a.createdAt)
        setOrders(rows)

        const invRows: Invoice[] = invSnap.docs.map((d) => toInvoice(d.id, d.data()))
        invRows.sort((a, b) => b.createdAt - a.createdAt)
        setInvoices(invRows)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load orders'
        setError(msg)
      })
      .finally(() => setQueryLoading(false))
  }, [user, authLoading])

  const firstName = (user?.displayName ?? '').split(' ')[0]

  if (authLoading || queryLoading) {
    return (
      <section className="section">
        <div className="container">
          <p className="overline">Your account</p>
          <h1>{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>
          <div className={styles.skeleton}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="overline">Your account</p>
          <h1>{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>
          <div className={styles.errorAlert}>Could not load your orders. {error}</div>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container">
        <p className="overline">Your account</p>
        <h1>{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>

        {orders.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No repairs yet.</p>
            <Link href="/book" className={styles.emptyLink}>
              Book a repair
            </Link>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Order #</th>
                  <th className={styles.th}>Date</th>
                  <th className={styles.th}>Devices</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th + ' ' + styles.thRight}>Est. Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={styles.row}>
                    <td className={styles.td}>
                      <Link href={`/orders/${order.id}`} className={styles.orderLink}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className={styles.td + ' ' + styles.tdMuted}>
                      {new Date(order.createdAt).toLocaleDateString('en-BW', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className={styles.td + ' ' + styles.tdMuted}>
                      {order.devices.map((d) => d.modelName).join(', ')}
                    </td>
                    <td className={styles.td}>
                      <StatusPill status={order.status} />
                    </td>
                    <td className={styles.td + ' ' + styles.tdRight}>
                      {formatPula(order.estimatedTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoices section */}
        {invoices.length > 0 && (
          <div className={styles.invoicesSection}>
            <h2 className={styles.invoicesSectionTitle}>Invoices</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Invoice #</th>
                    <th className={styles.th}>Status</th>
                    <th className={`${styles.th} ${styles.thRight}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className={styles.row}>
                      <td className={styles.td}>
                        <Link href={`/orders/${inv.orderId}`} className={styles.orderLink}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className={styles.td}>
                        <InvoiceStatusPill status={inv.status} />
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {formatPula(inv.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

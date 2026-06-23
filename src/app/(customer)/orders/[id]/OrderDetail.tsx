'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/lib/auth/useAuth'
import type { Order, OrderEvent } from '@/lib/types/order'
import { StatusPill } from '@/components/orders/StatusPill'
import { StatusTimeline } from '@/components/orders/StatusTimeline'
import { formatPula } from '@/lib/money'
import styles from './order-detail.module.css'

interface Props {
  id: string
}

export function OrderDetail({ id }: Props) {
  const { user, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return

    setLoading(true)
    setError(null)
    setNotFound(false)

    const orderRef = doc(db, 'r31_orders', id)
    const eventsQuery = query(
      collection(db, 'r31_orders', id, 'events'),
      where('visibility', '==', 'customer'),
    )

    Promise.all([getDoc(orderRef), getDocs(eventsQuery)])
      .then(([orderSnap, eventsSnap]) => {
        if (!orderSnap.exists()) {
          setNotFound(true)
          return
        }

        const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order

        // Guard: only show the owner's own order
        if (orderData.customerId !== user.uid) {
          setNotFound(true)
          return
        }

        const eventRows: OrderEvent[] = eventsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as OrderEvent),
        )

        setOrder(orderData)
        setEvents(eventRows)
      })
      .catch((err: unknown) => {
        // Firestore returns permission-denied when not the owner → treat as not found
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
          setNotFound(true)
        } else {
          setError(msg)
        }
      })
      .finally(() => setLoading(false))
  }, [id, user, authLoading])

  if (authLoading || loading) {
    return (
      <section className="section">
        <div className="container">
          <div className={styles.skeleton}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (notFound) {
    return (
      <section className="section">
        <div className="container">
          <div className={styles.notFound}>
            <h2 className={styles.notFoundTitle}>Order not found</h2>
            <p className={styles.notFoundText}>
              This order doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/account" className={styles.backLink}>
              Back to my orders
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className={styles.errorAlert}>Could not load order. {error}</div>
          <Link href="/account" className={styles.backLink}>
            Back to my orders
          </Link>
        </div>
      </section>
    )
  }

  if (!order) return null

  // Group items by device
  const deviceItems = order.devices.map((device) => ({
    device,
    items: order.items.filter((item) => item.deviceId === device.deviceId),
  }))

  return (
    <section className="section">
      <div className="container">
        {/* Back link */}
        <Link href="/account" className={styles.backLink}>
          ← My orders
        </Link>

        {/* Order header */}
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <p className="overline">Order {order.orderNumber}</p>
            <time className={styles.date} dateTime={new Date(order.createdAt).toISOString()}>
              {new Date(order.createdAt).toLocaleDateString('en-BW', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
          <StatusPill status={order.status} />
        </div>

        {/* Status timeline */}
        {events.length > 0 && (
          <div className={styles.timelineSection}>
            <h2 className={styles.sectionTitle}>Progress</h2>
            <StatusTimeline events={events} />
          </div>
        )}

        {/* Line items grouped by device */}
        <div className={styles.itemsSection}>
          <h2 className={styles.sectionTitle}>Repairs</h2>
          {deviceItems.map(({ device, items }) => (
            <div key={device.deviceId} className={styles.deviceCard}>
              <div className={styles.deviceHeader}>
                <span className={styles.deviceName}>
                  {device.modelName}
                  {device.label ? ` — ${device.label}` : ''}
                </span>
              </div>
              {items.length === 0 ? (
                <p className={styles.noItems}>No services for this device.</p>
              ) : (
                <ul className={styles.itemList}>
                  {items.map((item) => (
                    <li key={item.itemId} className={styles.item}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>
                          {item.serviceName}
                          {item.variant ? (
                            <span className={styles.itemVariant}> · {item.variant}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className={styles.itemPrices}>
                        {item.finalAmount !== undefined ? (
                          <>
                            <span className={styles.finalAmount}>
                              {formatPula(item.finalAmount)}
                            </span>
                            {item.finalAmount !== item.quotedAmount && (
                              <span className={styles.quotedAmount}>
                                was {formatPula(item.quotedAmount)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={styles.quotedAmountOnly}>
                            {formatPula(item.quotedAmount)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Estimated total</span>
            <span className={styles.totalValue}>{formatPula(order.estimatedTotal)}</span>
          </div>
          {order.finalTotal !== undefined && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Final total</span>
              <span className={styles.totalValueFinal}>{formatPula(order.finalTotal)}</span>
            </div>
          )}
        </div>

        {/* Phase 2: payment / invoice / e-sign */}
      </div>
    </section>
  )
}

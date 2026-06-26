'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/lib/auth/useAuth'
import type { Order, OrderEvent } from '@/lib/types/order'
import type { Invoice } from '@/lib/types/invoice'
import type { Warranty } from '@/lib/types/warranty'
import type { Claim } from '@/lib/types/warranty'
import { toInvoice } from '@/lib/invoices/mappers'
import { toClaim } from '@/lib/warranties/mappers'
import { warrantyState } from '@/lib/warranties/expiry'
import { StatusPill } from '@/components/orders/StatusPill'
import { StatusTimeline } from '@/components/orders/StatusTimeline'
import { DownloadInvoiceButton } from '@/components/invoices/DownloadInvoiceButton'
import { PaymentBadge } from '@/components/invoices/PaymentBadge'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { ProofUploader } from '@/components/invoices/ProofUploader'
import { WarrantyCard } from '@/components/warranties/WarrantyCard'
import { ClaimForm } from '@/components/warranties/ClaimForm'
import { ClaimStatusPill } from '@/components/warranties/ClaimStatusPill'
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
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceTick, setInvoiceTick] = useState(0)
  const refetchInvoice = useCallback(() => setInvoiceTick((t) => t + 1), [])
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [claimsByWarranty, setClaimsByWarranty] = useState<Record<string, Claim[]>>({})
  const [showClaimForm, setShowClaimForm] = useState<string | null>(null)

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

  // Load invoice when order has one (re-runs on refetchInvoice call)
  useEffect(() => {
    if (!order?.invoiceId) return
    getDoc(doc(db, 'r31_invoices', order.invoiceId))
      .then((snap) => {
        if (snap.exists()) setInvoice(toInvoice(snap.id, snap.data()))
      })
      .catch(() => {
        // Invoice card will just not show on error — silent
      })
  }, [order?.invoiceId, invoiceTick])

  useEffect(() => {
    if (!order || order.status !== 'completed') return
    getDocs(query(
      collection(db, 'r31_warranties'),
      where('orderId', '==', id),
    ))
      .then((snap) => {
        setWarranties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Warranty)))
      })
      .catch(() => {})
  }, [order, id])

  useEffect(() => {
    if (!warranties.length) return
    const claimed = warranties.filter((w) => w.status === 'claimed')
    if (!claimed.length) return
    Promise.all(
      claimed.map((w) =>
        getDocs(collection(db, 'r31_warranties', w.id, 'claims'))
          .then((snap) => ({
            warrantyId: w.id,
            claims: snap.docs.map((d) => toClaim(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt),
          })),
      ),
    ).then((results) => {
      const map: Record<string, Claim[]> = {}
      for (const r of results) map[r.warrantyId] = r.claims
      setClaimsByWarranty(map)
    }).catch(() => {})
  }, [warranties])

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

        {/* Invoice card */}
        {invoice && (
          <div className={styles.invoiceSection}>
            <h2 className={styles.sectionTitle}>Invoice</h2>
            <div className={styles.invoiceCard}>
              {/* Header: invoice number, status pills, download */}
              <div className={styles.invoiceHeader}>
                <div className={styles.invoiceHeaderMeta}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                    {invoice.invoiceNumber}
                  </span>
                  <InvoiceStatusPill status={invoice.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
                <DownloadInvoiceButton invoice={invoice} />
              </div>

              {/* Line items */}
              <ul className={styles.invoiceLineList}>
                {invoice.lineItems.map((line) => (
                  <li key={line.lineId} className={styles.invoiceLine}>
                    <span className={styles.invoiceLineDesc}>{line.description}</span>
                    <span className={styles.invoiceLineAmount}>{formatPula(line.amount)}</span>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <div className={styles.invoiceTotals}>
                {invoice.discount && (
                  <div className={styles.invoiceTotalRow}>
                    <span className={styles.invoiceTotalLabel}>Discount</span>
                    <span className={styles.invoiceTotalValue}>− {formatPula(invoice.discountAmount)}</span>
                  </div>
                )}
                <div className={styles.invoiceTotalRow}>
                  <span className={styles.invoiceTotalLabel}>Total</span>
                  <span className={styles.invoiceTotalFinal}>{formatPula(invoice.total)}</span>
                </div>
              </div>

              {/* Payment actions */}
              {invoice.status === 'issued' && (
                <div className={styles.invoiceActions}>
                  <p className={styles.invoiceCashNote}>
                    Pay at the shop — bring your device and pay in person.
                  </p>
                  <ProofUploader
                    orderId={order.id}
                    invoiceId={invoice.id}
                    onDone={refetchInvoice}
                  />
                </div>
              )}
              {invoice.status === 'payment_submitted' && (
                <p className={styles.invoiceAwaitingNote}>
                  Proof received — awaiting verification.
                </p>
              )}
            </div>
          </div>
        )}
        {order.status === 'completed' && warranties.length > 0 && (
          <div className={styles.warrantiesSection}>
            <h2 className={styles.sectionTitle}>Warranties</h2>
            {warranties.map((w) => {
              const state = warrantyState(w, Date.now())
              const wClaims = claimsByWarranty[w.id] ?? []
              const latestClaim = wClaims[0] ?? null
              return (
                <div key={w.id}>
                  <WarrantyCard warranty={w} />
                  {state === 'active' && showClaimForm !== w.id && (
                    <button
                      type="button"
                      onClick={() => setShowClaimForm(w.id)}
                      style={{ marginTop: 'var(--space-2)', minHeight: 40 }}
                    >
                      Raise a claim
                    </button>
                  )}
                  {state === 'active' && showClaimForm === w.id && (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <ClaimForm
                        warrantyId={w.id}
                        onDone={() => {
                          setShowClaimForm(null)
                          setWarranties((prev) =>
                            prev.map((pw) => pw.id === w.id ? { ...pw, status: 'claimed' } : pw)
                          )
                        }}
                      />
                    </div>
                  )}
                  {latestClaim && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <ClaimStatusPill status={latestClaim.status} />
                      {latestClaim.adminNotes && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                          {latestClaim.adminNotes}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

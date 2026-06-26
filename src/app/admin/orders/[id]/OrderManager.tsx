'use client'
import { useState } from 'react'
import { auth, storage } from '@/lib/firebase/client'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import {
  changeOrderStatusAction,
  cancelOrderAction,
  editLineAction,
  addOrderNoteAction,
  completeCollectionAction,
} from '@/app/admin/orders/actions'
import {
  createInvoiceAction,
  updateInvoiceAction,
  issueInvoiceAction,
  markPaidCashAction,
  verifyPaymentAction,
} from '@/app/admin/invoices/actions'
import { StatusPill } from '@/components/orders/StatusPill'
import { StatusTimeline } from '@/components/orders/StatusTimeline'
import { InvoiceEditor } from '@/components/invoices/InvoiceEditor'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { DownloadInvoiceButton } from '@/components/invoices/DownloadInvoiceButton'
import { SignaturePad } from '@/components/orders/SignaturePad'
import { ORDER_STATUSES, statusMeta, type Order, type OrderEvent, type OrderStatus } from '@/lib/types/order'
import type { Invoice } from '@/lib/types/invoice'
import { formatPula } from '@/lib/money'
import styles from './OrderManager.module.css'

/* ---- module-level helpers ---- */
async function token(): Promise<string> {
  const t = await auth.currentUser?.getIdToken()
  if (!t) throw new Error('not signed in')
  return t
}

async function uploadSignature(orderId: string, pngDataUrl: string): Promise<string> {
  const r = ref(storage, `r31/signatures/${orderId}/${Date.now()}.png`)
  const snap = await uploadString(r, pngDataUrl, 'data_url')
  return getDownloadURL(snap.ref)
}

/* ---- status progression: what's the natural next step ---- */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'received',
  received: 'diagnosing',
  diagnosing: 'in_repair',
  awaiting_approval: 'in_repair',
  awaiting_parts: 'in_repair',
  in_repair: 'ready',
}

interface Props {
  order: Order
  events: OrderEvent[]
  invoice?: Invoice | null
  onChanged?: () => void
}

export function OrderManager({ order, events, invoice, onChanged }: Props) {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)

  async function getToken(): Promise<string | null> {
    return auth.currentUser?.getIdToken() ?? null
  }

  function showFeedback(ok: boolean, msg: string) {
    setFeedback({ ok, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  async function handleStatusChange(toStatus: OrderStatus, note?: string) {
    const token = await getToken()
    if (!token) { showFeedback(false, 'Not signed in'); return }
    setBusy(true)
    try {
      const result = await changeOrderStatusAction(token, order.id, toStatus, note)
      if (result.ok) {
        showFeedback(true, 'Status updated')
        onChanged?.()
      } else {
        showFeedback(false, result.error ?? 'Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    const token = await getToken()
    if (!token) { showFeedback(false, 'Not signed in'); return }
    setBusy(true)
    try {
      const result = await cancelOrderAction(token, order.id)
      if (result.ok) {
        showFeedback(true, 'Order cancelled')
        onChanged?.()
      } else {
        showFeedback(false, result.error ?? 'Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleEditLine(itemId: string) {
    const raw = editAmounts[itemId]
    if (!raw) return
    const pula = parseFloat(raw)
    if (isNaN(pula) || pula < 0) { showFeedback(false, 'Invalid amount'); return }
    const thebe = Math.round(pula * 100)
    const token = await getToken()
    if (!token) { showFeedback(false, 'Not signed in'); return }
    setBusy(true)
    try {
      const result = await editLineAction(token, order.id, { itemId, finalAmount: thebe })
      if (result.ok) {
        showFeedback(true, 'Price saved')
        setEditAmounts((prev) => { const next = { ...prev }; delete next[itemId]; return next })
        onChanged?.()
      } else {
        showFeedback(false, result.error ?? 'Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleAddNote() {
    const note = noteText.trim()
    if (!note) return
    const token = await getToken()
    if (!token) { showFeedback(false, 'Not signed in'); return }
    setBusy(true)
    try {
      const result = await addOrderNoteAction(token, order.id, note, 'internal')
      if (result.ok) {
        showFeedback(true, 'Note saved')
        setNoteText('')
        onChanged?.()
      } else {
        showFeedback(false, result.error ?? 'Failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const nextStatus = NEXT_STATUS[order.status]
  const isCancelled = order.status === 'cancelled'

  /* group items by device */
  const byDevice = order.devices.map((d) => ({
    device: d,
    items: order.items.filter((it) => it.deviceId === d.deviceId),
  }))

  /* activity log — all events, sorted newest first */
  const sorted = [...events].sort((a, b) => b.at - a.at)
  const customerEvents = events.filter((e) => e.visibility === 'customer')

  return (
    <div className={styles.root}>
      {/* ---- Header ---- */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={`overline ${styles.overline}`}>Order</p>
          <h1 className={styles.orderNum}>{order.orderNumber}</h1>
          <p className={styles.customer}>{order.customerName} · {order.customerPhone}</p>
        </div>
        <div className={styles.headerRight}>
          <StatusPill status={order.status} />
        </div>
      </div>

      {/* ---- Feedback ---- */}
      {feedback && (
        <div
          role="alert"
          className={`${styles.alert} ${feedback.ok ? styles.alertOk : styles.alertErr}`}
        >
          {feedback.msg}
        </div>
      )}

      {/* ---- Status control ---- */}
      {!isCancelled && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Status</h2>
          <div className={styles.statusRow}>
            {nextStatus && (
              <button
                type="button"
                className={`${styles.btnPrimary}`}
                disabled={busy}
                onClick={() => handleStatusChange(nextStatus, undefined)}
              >
                Mark {statusMeta[nextStatus].label}
              </button>
            )}
            <div className={styles.statusMenu}>
              <p className={styles.menuLabel}>Set status:</p>
              <div className={styles.menuButtons}>
                {ORDER_STATUSES.filter((s) => s !== order.status && s !== 'cancelled' && s !== nextStatus).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.btnGhost}
                    disabled={busy}
                    onClick={() => handleStatusChange(s, undefined)}
                  >
                    {statusMeta[s].label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.btnDanger}`}
                  disabled={busy}
                  onClick={handleCancel}
                >
                  Cancel order
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Line items ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Items</h2>
        {byDevice.map(({ device, items }) => (
          <div key={device.deviceId} className={styles.deviceGroup}>
            <h3 className={styles.deviceName}>{device.modelName}{device.label ? ` · ${device.label}` : ''}</h3>
            <div className={styles.lineList}>
              {items.map((item) => {
                const displayAmount = item.finalAmount ?? item.quotedAmount
                const editing = editAmounts[item.itemId] !== undefined
                return (
                  <div key={item.itemId} className={styles.lineItem}>
                    <span className={styles.lineName}>{item.serviceName}</span>
                    <div className={styles.linePrice}>
                      {editing ? (
                        <div className={styles.priceEdit}>
                          <span className={styles.pricePrefix}>P</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={styles.priceInput}
                            value={editAmounts[item.itemId]}
                            onChange={(e) =>
                              setEditAmounts((prev) => ({ ...prev, [item.itemId]: e.target.value }))
                            }
                            aria-label={`Price for ${item.serviceName}`}
                          />
                          <button
                            type="button"
                            className={styles.btnSm}
                            disabled={busy}
                            onClick={() => handleEditLine(item.itemId)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnSm} ${styles.btnGhostSm}`}
                            onClick={() =>
                              setEditAmounts((prev) => {
                                const next = { ...prev }
                                delete next[item.itemId]
                                return next
                              })
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={item.finalAmount != null ? styles.priceFinal : styles.priceQuoted}>
                            {formatPula(displayAmount)}
                          </span>
                          {item.finalAmount != null && (
                            <span className={styles.priceOrig}>{formatPula(item.quotedAmount)}</span>
                          )}
                          <button
                            type="button"
                            className={`${styles.btnSm} ${styles.btnGhostSm}`}
                            onClick={() =>
                              setEditAmounts((prev) => ({
                                ...prev,
                                [item.itemId]: (displayAmount / 100).toFixed(2),
                              }))
                            }
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalAmount}>{formatPula(order.finalTotal ?? order.estimatedTotal)}</span>
        </div>
      </section>

      {/* ---- Internal note ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Internal note</h2>
        <div className={styles.noteRow}>
          <textarea
            className={styles.noteArea}
            rows={3}
            placeholder="Add an internal note (not visible to customer)…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            aria-label="Internal note"
          />
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={busy || !noteText.trim()}
            onClick={handleAddNote}
          >
            Add note
          </button>
        </div>
      </section>

      {/* ---- Activity log ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Activity log</h2>
        {sorted.length === 0 ? (
          <p className={styles.empty}>No activity yet.</p>
        ) : (
          <ol className={styles.logList}>
            {sorted.map((e) => (
              <li key={e.id} className={`${styles.logEntry} ${e.visibility === 'internal' ? styles.logInternal : ''}`}>
                <div className={styles.logDot} aria-hidden="true" />
                <div className={styles.logContent}>
                  <div className={styles.logMeta}>
                    <span className={styles.logType}>
                      {e.type === 'status_change' && e.toStatus
                        ? statusMeta[e.toStatus].label
                        : e.type === 'line_edit'
                        ? 'Price updated'
                        : 'Note'}
                    </span>
                    {e.visibility === 'internal' && (
                      <span className={styles.internalBadge}>internal</span>
                    )}
                    <time className={styles.logTime} dateTime={new Date(e.at).toISOString()}>
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </div>
                  {e.note && <p className={styles.logNote}>{e.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        {customerEvents.length > 0 && (
          <details className={styles.customerTimeline}>
            <summary className={styles.timelineSummary}>Customer-visible timeline</summary>
            <StatusTimeline events={customerEvents} />
          </details>
        )}
      </section>

      {/* ---- Invoice ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Invoice</h2>

        {!invoice ? (
          /* No invoice yet */
          <button
            type="button"
            className={styles.btnGhost}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await createInvoiceAction(await token(), order.id)
                if (result.ok) { showFeedback(true, 'Invoice created'); onChanged?.() }
                else showFeedback(false, result.error ?? 'Failed to create invoice')
              } catch (e) {
                showFeedback(false, e instanceof Error ? e.message : 'Failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Create invoice
          </button>
        ) : invoice.status === 'draft' ? (
          /* Draft: editable */
          <>
            <InvoiceEditor
              initialLineItems={invoice.lineItems}
              initialDiscount={invoice.discount}
              onSave={async (input) => {
                const result = await updateInvoiceAction(await token(), invoice.id, input)
                if (result.ok) { showFeedback(true, 'Invoice saved'); await onChanged?.() }
                else showFeedback(false, result.error ?? 'Save failed')
              }}
            />
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busy}
              style={{ marginTop: 'var(--space-4)' }}
              onClick={async () => {
                setBusy(true)
                try {
                  const result = await issueInvoiceAction(await token(), invoice.id)
                  if (result.ok) { showFeedback(true, 'Invoice issued'); onChanged?.() }
                  else showFeedback(false, result.error ?? 'Failed to issue')
                } catch (e) {
                  showFeedback(false, e instanceof Error ? e.message : 'Failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Issue invoice
            </button>
          </>
        ) : (
          /* issued / payment_submitted / paid / cancelled */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              <InvoiceStatusPill status={invoice.status} />
              {(invoice.status === 'issued' || invoice.status === 'payment_submitted' || invoice.status === 'paid') && (
                <DownloadInvoiceButton invoice={invoice} />
              )}
            </div>

            {invoice.status === 'issued' && (
              <button
                type="button"
                className={styles.btnGhost}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const result = await markPaidCashAction(await token(), invoice.id)
                    if (result.ok) { showFeedback(true, 'Marked as paid'); onChanged?.() }
                    else showFeedback(false, result.error ?? 'Failed')
                  } catch (e) {
                    showFeedback(false, e instanceof Error ? e.message : 'Failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Mark paid (cash)
              </button>
            )}

            {invoice.status === 'payment_submitted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {invoice.proofOfPaymentURL && (
                  <a
                    href={invoice.proofOfPaymentURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', fontSize: 'var(--fs-sm)' }}
                  >
                    View proof of payment
                  </a>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        const result = await verifyPaymentAction(await token(), invoice.id, true)
                        if (result.ok) { showFeedback(true, 'Payment approved'); onChanged?.() }
                        else showFeedback(false, result.error ?? 'Failed')
                      } catch (e) {
                        showFeedback(false, e instanceof Error ? e.message : 'Failed')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Approve payment
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.btnDanger}`}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        const result = await verifyPaymentAction(await token(), invoice.id, false)
                        if (result.ok) { showFeedback(true, 'Payment rejected'); onChanged?.() }
                        else showFeedback(false, result.error ?? 'Failed')
                      } catch (e) {
                        showFeedback(false, e instanceof Error ? e.message : 'Failed')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---- Complete collection ---- */}
      {order.status === 'ready' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Complete collection</h2>
          {!showSignaturePad ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowSignaturePad(true)}
            >
              Collect &amp; sign
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {order.paymentStatus !== 'paid' && (
                <p style={{ color: 'var(--warning)', fontSize: 'var(--fs-sm)', margin: 0 }}>
                  Invoice unpaid ⚠ — complete anyway?
                </p>
              )}
              <SignaturePad
                onConfirm={async (png) => {
                  setBusy(true)
                  try {
                    const url = await uploadSignature(order.id, png)
                    const result = await completeCollectionAction(await token(), order.id, url)
                    if (result.ok) {
                      showFeedback(true, 'Order completed')
                      setShowSignaturePad(false)
                      onChanged?.()
                    } else {
                      showFeedback(false, result.error ?? 'Failed')
                    }
                  } catch (e) {
                    showFeedback(false, e instanceof Error ? e.message : 'Failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              />
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnGhostSm}`}
                onClick={() => setShowSignaturePad(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import {
  changeOrderStatusAction,
  cancelOrderAction,
  editLineAction,
  addOrderNoteAction,
} from '@/app/admin/orders/actions'
import { StatusPill } from '@/components/orders/StatusPill'
import { StatusTimeline } from '@/components/orders/StatusTimeline'
import { ORDER_STATUSES, statusMeta, type Order, type OrderEvent, type OrderStatus } from '@/lib/types/order'
import { formatPula } from '@/lib/money'
import styles from './OrderManager.module.css'

/* ---- status progression: what's the natural next step ---- */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'received',
  received: 'diagnosing',
  diagnosing: 'in_repair',
  in_repair: 'ready',
}

interface Props {
  order: Order
  events: OrderEvent[]
  onChanged?: () => void
}

export function OrderManager({ order, events, onChanged }: Props) {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

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
  const deviceMap = new Map(order.devices.map((d) => [d.deviceId, d]))
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
    </div>
  )
}

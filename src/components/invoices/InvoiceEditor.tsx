'use client'
import { useState } from 'react'
import type { InvoiceLineItem, Discount } from '@/lib/types/invoice'
import { computeTotals } from '@/lib/invoices/totals'
import { formatPula, toThebe, fromThebe } from '@/lib/money'
import styles from './InvoiceEditor.module.css'

interface Props {
  initialLineItems: InvoiceLineItem[]
  initialDiscount: Discount | null
  onSave: (input: { lineItems: InvoiceLineItem[]; discount: Discount | null }) => Promise<void>
}

export function InvoiceEditor({ initialLineItems, initialDiscount, onSave }: Props) {
  const [lines, setLines] = useState<InvoiceLineItem[]>(initialLineItems)
  const [discount, setDiscount] = useState<Discount | null>(initialDiscount)
  const [busy, setBusy] = useState(false)
  const totals = computeTotals(lines, discount)

  function setLine(idx: number, patch: Partial<InvoiceLineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { lineId: `new-${prev.length}-${Date.now()}`, description: '', sourceItemId: null, amount: 0 }])
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className={styles.root}>
      {lines.map((l, i) => (
        <div key={l.lineId} className={styles.row}>
          <input aria-label={`Description ${i + 1}`} value={l.description}
            onChange={(e) => setLine(i, { description: e.target.value })} />
          <input aria-label={`Amount ${i + 1}`} type="number" min="0" step="0.01"
            value={l.amount === 0 ? '' : fromThebe(l.amount)}
            onChange={(e) => setLine(i, { amount: toThebe(Number(e.target.value) || 0) })} />
          <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => removeLine(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={addLine}>+ Add line</button>

      <div className={styles.discountRow}>
        <select aria-label="Discount type"
          value={discount?.type ?? 'none'}
          onChange={(e) => {
            const v = e.target.value
            setDiscount(v === 'none' ? null : { type: v as 'amount' | 'percent', value: 0 })
          }}>
          <option value="none">No discount</option>
          <option value="amount">Amount (P)</option>
          <option value="percent">Percent (%)</option>
        </select>
        {discount && (
          <input aria-label="Discount value" type="number" min="0"
            value={discount.value === 0 ? '' : (discount.type === 'amount' ? fromThebe(discount.value) : discount.value)}
            onChange={(e) => {
              const n = Number(e.target.value) || 0
              setDiscount({ type: discount.type, value: discount.type === 'amount' ? toThebe(n) : n })
            }} />
        )}
      </div>

      <p className={styles.totalLine}>
        Subtotal {formatPula(totals.subtotal)}
        {totals.discountAmount > 0 && ` · −${formatPula(totals.discountAmount)}`}
      </p>
      <p className={styles.total} data-testid="invoice-total">Total {formatPula(totals.total)}</p>

      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); try { await onSave({ lineItems: lines, discount }) } finally { setBusy(false) } }}>
        {busy ? 'Saving…' : 'Save invoice'}
      </button>
    </div>
  )
}

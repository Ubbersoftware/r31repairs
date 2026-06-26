'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { toInvoice } from '@/lib/invoices/mappers'
import type { Invoice, InvoiceStatus } from '@/lib/types/invoice'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { formatPula } from '@/lib/money'
import styles from './InvoiceQueue.module.css'

const FILTERS: (InvoiceStatus | 'all')[] = ['all', 'payment_submitted', 'issued', 'paid', 'draft', 'cancelled']

export function InvoiceQueue() {
  const [items, setItems] = useState<Invoice[]>([])
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('payment_submitted')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const snap = await getDocs(collection(db, 'r31_invoices'))
      setItems(snap.docs.map((d) => toInvoice(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt))
      setLoading(false)
    })()
  }, [])

  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter)

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading invoices…</p>

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={filter === f ? styles.active : ''} onClick={() => setFilter(f)}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>
      <ul className={styles.list}>
        {shown.length === 0 ? (
          <li className={styles.empty}>No invoices.</li>
        ) : (
          shown.map((inv) => (
            <li key={inv.id} className={inv.status === 'payment_submitted' ? styles.flag : ''}>
              <Link href={`/admin/orders/${inv.orderId}`}>
                <span>{inv.invoiceNumber}</span>
                <span>{inv.customerName}</span>
                <span>{formatPula(inv.total)}</span>
                <InvoiceStatusPill status={inv.status} />
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

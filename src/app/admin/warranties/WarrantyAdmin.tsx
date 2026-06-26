'use client'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Warranty } from '@/lib/types/warranty'
import { toWarranty } from '@/lib/warranties/mappers'
import { warrantyState } from '@/lib/warranties/expiry'
import { WarrantyStatusPill } from '@/components/warranties/WarrantyStatusPill'
import styles from './WarrantyAdmin.module.css'

type Filter = 'all' | 'active' | 'expired' | 'claimed'

export function WarrantyAdmin() {
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    void (async () => {
      const snap = await getDocs(collection(db, 'r31_warranties'))
      setWarranties(
        snap.docs
          .map((d) => toWarranty(d.id, d.data()))
          .sort((a, b) => b.createdAt - a.createdAt),
      )
      setLoading(false)
    })()
  }, [])

  const now = Date.now()
  const shown =
    filter === 'all'
      ? warranties
      : warranties.filter((w) => warrantyState(w, now) === filter)

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading warranties…</p>

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        {(['all', 'active', 'expired', 'claimed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? styles.active : ''}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div>
        <h2 className={styles.sectionTitle}>All Warranties</h2>
        <ul className={styles.list}>
          {shown.length === 0 ? (
            <li className={styles.empty}>No warranties.</li>
          ) : (
            shown.map((w) => (
              <li key={w.id} className={styles.item}>
                <div>
                  <div className={styles.service}>{w.serviceName}</div>
                  <div className={styles.model}>{w.phoneModelName}</div>
                </div>
                <WarrantyStatusPill state={warrantyState(w, now)} />
                <span className={styles.expiry}>
                  {new Date(w.endDate).toLocaleDateString('en-BW', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

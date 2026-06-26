'use client'
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import type { Warranty, Claim, ClaimStatus } from '@/lib/types/warranty'
import { CLAIM_STATUSES, claimStatusMeta } from '@/lib/types/warranty'
import { toWarranty, toClaim } from '@/lib/warranties/mappers'
import { warrantyState } from '@/lib/warranties/expiry'
import { WarrantyStatusPill } from '@/components/warranties/WarrantyStatusPill'
import { ClaimStatusPill } from '@/components/warranties/ClaimStatusPill'
import { updateClaimAction } from './actions'
import styles from './WarrantyAdmin.module.css'

type Filter = 'all' | 'active' | 'expired' | 'claimed'

interface ClaimRow extends Claim {
  warrantyServiceName: string
  warrantyPhoneModel: string
}

export function WarrantyAdmin() {
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const snap = await getDocs(collection(db, 'r31_warranties'))
    const ws = snap.docs
      .map((d) => toWarranty(d.id, d.data()))
      .sort((a, b) => b.createdAt - a.createdAt)
    setWarranties(ws)

    const claimedWs = ws.filter((w) => w.status === 'claimed')
    const claimArrays = await Promise.all(
      claimedWs.map(async (w) => {
        const cs = await getDocs(collection(db, 'r31_warranties', w.id, 'claims'))
        return cs.docs.map((d): ClaimRow => ({
          ...toClaim(d.id, d.data()),
          warrantyServiceName: w.serviceName,
          warrantyPhoneModel: w.phoneModelName,
        }))
      }),
    )
    setClaims(claimArrays.flat().sort((a, b) => b.createdAt - a.createdAt))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleStatusChange(warrantyId: string, claimId: string, status: ClaimStatus, adminNotes: string | null) {
    setBusy(claimId)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) return
      await updateClaimAction(idToken, warrantyId, claimId, { status, adminNotes })
      await load()
    } finally { setBusy(null) }
  }

  const now = Date.now()
  const shown =
    filter === 'all'
      ? warranties
      : warranties.filter((w) => warrantyState(w, now) === filter)

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className={styles.root}>
      {claims.length > 0 && (
        <div>
          <h2 className={styles.sectionTitle}>Claims Queue</h2>
          <ul className={styles.list}>
            {claims.map((c) => (
              <li key={c.id} className={`${styles.item} ${c.status === 'received' ? styles.flagged : ''}`} style={{ gridTemplateColumns: '1fr 1fr auto auto' }}>
                <div>
                  <div className={styles.service}>{c.warrantyServiceName} — {c.warrantyPhoneModel}</div>
                  <div className={styles.model}>{c.description}</div>
                </div>
                <ClaimStatusPill status={c.status} />
                <select
                  aria-label="Claim status"
                  value={c.status}
                  disabled={busy === c.id}
                  onChange={(e) => handleStatusChange(c.warrantyId, c.id, e.target.value as ClaimStatus, c.adminNotes)}
                  style={{ minHeight: 36 }}
                >
                  {CLAIM_STATUSES.map((s) => (
                    <option key={s} value={s}>{claimStatusMeta[s].label}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className={styles.sectionTitle}>All Warranties</h2>
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

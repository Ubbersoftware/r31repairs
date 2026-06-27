import type { Warranty } from '@/lib/types/warranty'
import { warrantyState } from '@/lib/warranties/expiry'
import { WarrantyStatusPill } from './WarrantyStatusPill'
import styles from './WarrantyCard.module.css'

export function WarrantyCard({ warranty }: { warranty: Warranty }) {
  const state = warrantyState(warranty, Date.now())
  return (
    <div className={styles.card}>
      <span className={styles.service}>{warranty.serviceName}</span>
      <span className={styles.model}>{warranty.phoneModelName}</span>
      <div className={styles.row}>
        <WarrantyStatusPill state={state} />
        <span className={styles.expiry}>
          Expires{' '}
          {new Date(warranty.endDate).toLocaleDateString('en-BW', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </span>
      </div>
    </div>
  )
}

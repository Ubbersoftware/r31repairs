import type { OrderStatus } from '@/lib/types/order'
import { statusMeta } from '@/lib/types/order'
import styles from './StatusPill.module.css'

export function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status]
  return (
    <span
      className={`${styles.pill} ${meta.hold ? styles.hold : ''}`}
      data-hold={meta.hold}
      style={{ '--pill': `var(${meta.token})` } as React.CSSProperties}
    >
      {meta.hold && <span aria-hidden="true" className={styles.pause}>⏸</span>}
      {meta.label}
    </span>
  )
}

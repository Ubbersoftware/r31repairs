import type { OrderEvent } from '@/lib/types/order'
import { statusMeta } from '@/lib/types/order'
import styles from './StatusTimeline.module.css'

export function StatusTimeline({ events }: { events: OrderEvent[] }) {
  const visible = events
    .filter((e) => e.visibility === 'customer')
    .slice()
    .sort((a, b) => a.at - b.at)

  if (!visible.length) return null

  return (
    <ol className={styles.timeline}>
      {visible.map((e) => (
        <li key={e.id} className={styles.entry}>
          <span className={styles.dot} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.label}>
              {e.toStatus ? statusMeta[e.toStatus].label : 'Update'}
            </p>
            {e.note && <p className={styles.note}>{e.note}</p>}
            <time className={styles.time} dateTime={new Date(e.at).toISOString()}>
              {new Date(e.at).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}

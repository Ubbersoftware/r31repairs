import type { ReactNode } from 'react'
import styles from './Pill.module.css'

export type PillTone = 'info' | 'success' | 'warning' | 'danger'

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>
}

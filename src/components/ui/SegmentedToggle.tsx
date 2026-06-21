'use client'
import styles from './SegmentedToggle.module.css'

export type SegmentedOption = { value: string; label: string; hint?: string }

export function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className={styles.segmented} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`${styles.opt} ${o.value === value ? styles.active : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.hint && <span className={styles.save}>{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}

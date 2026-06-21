import styles from './FeatureList.module.css'

export function FeatureList({ items }: { items: { label: string; off?: boolean }[] }) {
  return (
    <ul className={styles.flist}>
      {items.map((it, i) => (
        <li key={i} className={it.off ? styles.off : undefined}>
          {it.label}
        </li>
      ))}
    </ul>
  )
}

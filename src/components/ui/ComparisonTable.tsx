import styles from './ComparisonTable.module.css'

export function ComparisonTable({
  columns,
  rows,
  featuredIndex,
}: {
  columns: string[]
  rows: { feature: string; values: string[] }[]
  featuredIndex?: number
}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Feature</th>
            {columns.map((c, i) => (
              <th key={c} className={i === featuredIndex ? styles.featured : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature}>
              <th scope="row">{r.feature}</th>
              {r.values.map((v, i) => (
                <td key={i} className={i === featuredIndex ? styles.featured : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

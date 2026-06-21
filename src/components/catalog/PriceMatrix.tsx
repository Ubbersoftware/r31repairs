import styles from './PriceMatrix.module.css'

export interface PriceRow {
  model: string
  price: string
  available: boolean
}

export function PriceMatrix({ rows }: { rows: PriceRow[] }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col" className={styles.priceCol}>Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model}>
              <th scope="row">{r.model}</th>
              <td className={`${styles.priceCol} ${r.available ? '' : styles.unavailable}`}>
                {r.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

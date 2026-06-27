import { OverviewDashboard } from './OverviewDashboard'
import styles from './page.module.css'

export default function AdminOverviewPage() {
  return (
    <>
      <p className="overline">Admin</p>
      <h1>Overview</h1>
      <p className={styles.intro}>Your shop at a glance.</p>
      <OverviewDashboard />
    </>
  )
}

import { RequireOwner } from '@/components/auth/RequireOwner'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import styles from './admin-layout.module.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireOwner>
      <div className={styles.shell}>
        <AdminSidebar />
        <main className={styles.main}>{children}</main>
      </div>
    </RequireOwner>
  )
}

import { WarrantyAdmin } from './WarrantyAdmin'

export default function AdminWarrantiesPage() {
  return (
    <section style={{ marginTop: 'var(--space-5)' }}>
      <h1 style={{ color: 'var(--text-strong)' }}>Warranties</h1>
      <WarrantyAdmin />
    </section>
  )
}

import { InvoiceQueue } from './InvoiceQueue'

export default function AdminInvoicesPage() {
  return (
    <section style={{ marginTop: 'var(--space-5)' }}>
      <h1 style={{ color: 'var(--text-strong)' }}>Invoices</h1>
      <InvoiceQueue />
    </section>
  )
}

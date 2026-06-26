import type { InvoiceStatus } from '@/lib/types/invoice'

const META: Record<InvoiceStatus, { label: string; token: string }> = {
  draft: { label: 'Draft', token: '--text-muted' },
  issued: { label: 'Issued', token: '--status-blue' },
  payment_submitted: { label: 'Payment submitted', token: '--warning' },
  paid: { label: 'Paid', token: '--success' },
  cancelled: { label: 'Cancelled', token: '--danger' },
}

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  const m = META[status]
  return <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{m.label}</span>
}

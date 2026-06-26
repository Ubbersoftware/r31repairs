import type { Order } from '@/lib/types/order'

const META: Record<Order['paymentStatus'], { label: string; token: string }> = {
  unpaid: { label: 'Unpaid', token: '--text-muted' },
  payment_submitted: { label: 'Awaiting verification', token: '--warning' },
  paid: { label: 'Paid', token: '--success' },
}

export function PaymentBadge({ status }: { status: Order['paymentStatus'] }) {
  const m = META[status]
  return <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{m.label}</span>
}

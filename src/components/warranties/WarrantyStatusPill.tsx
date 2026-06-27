import type { WarrantyState } from '@/lib/types/warranty'

const META: Record<WarrantyState, { label: string; token: string }> = {
  active:  { label: 'Active',  token: '--success' },
  expired: { label: 'Expired', token: '--text-muted' },
  claimed: { label: 'Claimed', token: '--warning' },
}

export function WarrantyStatusPill({ state }: { state: WarrantyState }) {
  const m = META[state]
  return (
    <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
      {m.label}
    </span>
  )
}

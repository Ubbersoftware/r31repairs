import type { ClaimStatus } from '@/lib/types/warranty'
import { claimStatusMeta } from '@/lib/types/warranty'

export function ClaimStatusPill({ status }: { status: ClaimStatus }) {
  const m = claimStatusMeta[status]
  return (
    <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
      {m.label}
    </span>
  )
}

export type WarrantyStatus = 'active' | 'claimed'
export type WarrantyState = 'active' | 'expired' | 'claimed'

export interface Warranty {
  id: string
  orderId: string
  customerId: string
  invoiceId: string | null
  itemId: string
  serviceName: string
  phoneModelName: string
  startDate: number
  endDate: number
  status: WarrantyStatus
  createdAt: number
  updatedAt?: number
}

export type ClaimStatus = 'received' | 'assessing' | 'resolved' | 'rejected'
export const CLAIM_STATUSES = ['received', 'assessing', 'resolved', 'rejected'] as const

export const claimStatusMeta: Record<ClaimStatus, { label: string; token: string }> = {
  received:  { label: 'Received',  token: '--status-blue' },
  assessing: { label: 'Assessing', token: '--warning' },
  resolved:  { label: 'Resolved',  token: '--success' },
  rejected:  { label: 'Rejected',  token: '--danger' },
}

export interface Claim {
  id: string
  warrantyId: string
  customerId: string
  description: string
  photoURLs: string[]
  status: ClaimStatus
  adminNotes: string | null
  createdAt: number
  updatedAt: number
}

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'orange_money', 'myzaka', 'pay2cell'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function isElectronic(m: PaymentMethod): boolean {
  return m !== 'cash'
}

export interface PaymentChannel {
  id: PaymentMethod
  label: string
  payToLabel: string
  details: string
}

// PLACEHOLDER pay-to details — real account/merchant numbers to be supplied by the
// shop owner; becomes admin-editable in Phase 5 settings.
export const PAYMENT_CHANNELS: PaymentChannel[] = [
  { id: 'bank_transfer', label: 'Bank transfer', payToLabel: 'Bank account', details: 'FNB Botswana — Acct 0000000000 (branch 28xxxx)' },
  { id: 'orange_money',  label: 'Orange Money',  payToLabel: 'Merchant',     details: 'Orange Money merchant 000000' },
  { id: 'myzaka',        label: 'MyZaka',        payToLabel: 'MyZaka number', details: '7XXXXXXX' },
  { id: 'pay2cell',      label: 'Pay2Cell',      payToLabel: 'Pay2Cell number', details: '7XXXXXXX' },
]

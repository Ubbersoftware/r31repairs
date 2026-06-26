import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const submit = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/(customer)/orders/actions', () => ({ submitProofOfPaymentAction: (...a: unknown[]) => submit(...a) }))
vi.mock('firebase/storage', () => ({
  ref: () => ({}), uploadBytes: async () => ({ ref: {} }), getDownloadURL: async () => 'https://x/p.png',
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'tok' } }, storage: {} }))

import { ProofUploader } from './ProofUploader'

describe('ProofUploader', () => {
  it('shows channel details and submits proof with the chosen method', async () => {
    const onDone = vi.fn()
    render(<ProofUploader orderId="o1" invoiceId="inv1" onDone={onDone} />)
    await userEvent.selectOptions(screen.getByLabelText(/payment method/i), 'orange_money')
    expect(screen.getByText(/merchant/i)).toBeInTheDocument()

    const file = new File(['x'], 'proof.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/upload proof/i), file)

    expect(submit).toHaveBeenCalledWith('tok', 'inv1', 'orange_money', 'https://x/p.png')
    expect(onDone).toHaveBeenCalled()
  })
})

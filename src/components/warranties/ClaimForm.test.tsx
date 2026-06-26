import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const raise = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/(customer)/warranties/actions', () => ({ raiseClaimAction: (...a: unknown[]) => raise(...a) }))
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  uploadBytes: async () => ({ ref: {} }),
  getDownloadURL: async () => 'https://x.com/photo.png',
}))
vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: async () => 'tok' } },
  storage: {},
}))

import { ClaimForm } from './ClaimForm'

describe('ClaimForm', () => {
  it('submits description + photoURLs to raiseClaimAction', async () => {
    const onDone = vi.fn()
    render(<ClaimForm warrantyId="w1" onDone={onDone} />)
    await userEvent.type(screen.getByLabelText(/describe the issue/i), 'screen cracked')
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/photos/i), file)
    await userEvent.click(screen.getByRole('button', { name: /submit claim/i }))
    expect(raise).toHaveBeenCalledWith('tok', 'w1', { description: 'screen cracked', photoURLs: ['https://x.com/photo.png'] })
    expect(onDone).toHaveBeenCalled()
  })
  it('disables submit when description is empty', async () => {
    render(<ClaimForm warrantyId="w1" onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /submit claim/i })).toBeDisabled()
  })
})

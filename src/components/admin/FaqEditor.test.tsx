// src/components/admin/FaqEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const saveSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/faq/actions', () => ({
  saveFaqAction: (...a: Parameters<typeof saveSpy>) => saveSpy(...a),
  deleteFaqAction: async () => ({ ok: true }),
  reorderFaqAction: async () => ({ ok: true }),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))
import { FaqEditor } from './FaqEditor'

const faqs = [{ id: 'faq-1', question: 'Q1', answer: 'A1', category: 'general', active: true, sortOrder: 1 }]
beforeEach(() => saveSpy.mockClear())

describe('FaqEditor', () => {
  it('edits and saves an item', async () => {
    render(<FaqEditor faqs={faqs} />)
    fireEvent.change(screen.getByLabelText('Question for faq-1'), { target: { value: 'Q1 edited' } })
    fireEvent.click(screen.getByRole('button', { name: /save faq-1/i }))
    await screen.findByText(/saved/i)
    expect(saveSpy).toHaveBeenCalledWith('owner', expect.objectContaining({ id: 'faq-1', question: 'Q1 edited' }))
  })
})

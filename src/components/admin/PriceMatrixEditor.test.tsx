// src/components/admin/PriceMatrixEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const saveSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/catalog/actions', () => ({ savePricesAction: (...a: Parameters<typeof saveSpy>) => saveSpy(...a) }))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))

import { PriceMatrixEditor } from './PriceMatrixEditor'

const services = [{ id: 'battery', name: 'Battery', slug: 'battery', category: 'power', description: '', hasVariants: false, variants: [], active: true, sortOrder: 1, imageURL: null }]
const models = [{ id: 'iphone-13', name: 'iPhone 13', brand: 'Apple', active: true, sortOrder: 1 }]
const matrix = [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }]

beforeEach(() => saveSpy.mockClear())

describe('PriceMatrixEditor', () => {
  it('renders the Pula value of a cell', () => {
    render(<PriceMatrixEditor services={services} models={models} matrix={matrix} />)
    expect((screen.getByLabelText('Battery price for iPhone 13') as HTMLInputElement).value).toBe('800')
  })
  it('marks dirty and saves only changed cells in thebe', async () => {
    render(<PriceMatrixEditor services={services} models={models} matrix={matrix} />)
    fireEvent.change(screen.getByLabelText('Battery price for iPhone 13'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await screen.findByText(/saved/i)
    expect(saveSpy).toHaveBeenCalledWith('owner', [
      { serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 90000, available: true },
    ])
  })
})

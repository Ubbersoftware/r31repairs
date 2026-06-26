import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceEditor } from './InvoiceEditor'
import type { InvoiceLineItem } from '@/lib/types/invoice'

const lines: InvoiceLineItem[] = [
  { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
]

describe('InvoiceEditor', () => {
  it('shows a live total and saves the edited line items', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<InvoiceEditor initialLineItems={lines} initialDiscount={null} onSave={onSave} />)
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('P1,200')

    await userEvent.click(screen.getByRole('button', { name: /add line/i }))
    const descs = screen.getAllByLabelText(/description/i)
    await userEvent.type(descs[descs.length - 1], 'Adhesive seal')
    const amounts = screen.getAllByLabelText(/amount/i)
    await userEvent.clear(amounts[amounts.length - 1])
    await userEvent.type(amounts[amounts.length - 1], '80')
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('P1,280')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith({
      lineItems: [
        { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
        expect.objectContaining({ description: 'Adhesive seal', sourceItemId: null, amount: 8000 }),
      ],
      discount: null,
    })
  })
})

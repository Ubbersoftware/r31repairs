import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Invoice } from '@/lib/types/invoice'

// PDFDownloadLink renders children as a function; mock to render a plain anchor
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
  PDFDownloadLink: ({ children }: any) => <a href="#">{typeof children === 'function' ? children({ loading: false }) : children}</a>,
}))

import { DownloadInvoiceButton } from './DownloadInvoiceButton'

const invoice = {
  id: 'inv1', invoiceNumber: 'INV-0007', total: 160000, currency: 'BWP',
  lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 160000 }],
  discount: null, subtotal: 160000, discountAmount: 0, status: 'issued',
  customerName: 'Thabo', customerPhone: '7', orderId: 'o1', customerId: 'c1',
  paymentMethod: null, proofOfPaymentURL: null, proofUploadedAt: null, verifiedBy: null,
  verifiedAt: null, issuedAt: 1, paidAt: null, createdAt: 1, updatedAt: 1, createdBy: 'o1',
} as Invoice

describe('DownloadInvoiceButton', () => {
  it('renders a download link labelled with the invoice number', () => {
    render(<DownloadInvoiceButton invoice={invoice} />)
    expect(screen.getByText(/INV-0007/)).toBeInTheDocument()
  })
})

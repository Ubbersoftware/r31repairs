'use client'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice } from '@/lib/types/invoice'
import { InvoicePdf } from './InvoicePdf'

export function DownloadInvoiceButton({ invoice }: { invoice: Invoice }) {
  return (
    <PDFDownloadLink
      document={<InvoicePdf invoice={invoice} />}
      fileName={`${invoice.invoiceNumber}.pdf`}
      style={{ color: 'var(--accent)', fontSize: 'var(--fs-sm)' }}
    >
      {({ loading }) => (loading ? 'Preparing…' : `Download ${invoice.invoiceNumber} (PDF)`)}
    </PDFDownloadLink>
  )
}

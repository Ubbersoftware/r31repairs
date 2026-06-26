import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Invoice } from '@/lib/types/invoice'
import { formatPula } from '@/lib/money'

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: '#111' },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: '#666' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  hr: { borderBottomWidth: 1, borderColor: '#ccc', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontSize: 13 },
})

export function InvoicePdf({ invoice }: { invoice: Invoice }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>31 Repairs</Text>
        <Text style={s.muted}>Gaborone, Botswana</Text>
        <View style={s.hr} />
        <View style={s.row}><Text>Invoice</Text><Text>{invoice.invoiceNumber}</Text></View>
        <View style={s.row}><Text>Customer</Text><Text>{invoice.customerName} · {invoice.customerPhone}</Text></View>
        <View style={s.row}><Text>Status</Text><Text>{invoice.status}</Text></View>
        <View style={s.hr} />
        {invoice.lineItems.map((li) => (
          <View key={li.lineId} style={s.row}><Text>{li.description}</Text><Text>{formatPula(li.amount)}</Text></View>
        ))}
        <View style={s.hr} />
        <View style={s.row}><Text>Subtotal</Text><Text>{formatPula(invoice.subtotal)}</Text></View>
        {invoice.discountAmount > 0 && (
          <View style={s.row}><Text>Discount</Text><Text>-{formatPula(invoice.discountAmount)}</Text></View>
        )}
        <View style={s.totalRow}><Text>Total</Text><Text>{formatPula(invoice.total)}</Text></View>
      </Page>
    </Document>
  )
}

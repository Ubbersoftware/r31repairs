import { getAllFaqs } from '@/lib/catalog/queries'
import { FaqEditor } from '@/components/admin/FaqEditor'

export default async function AdminFaqPage() {
  const faqs = await getAllFaqs()
  return (
    <>
      <p className="overline">Admin</p>
      <h1>FAQ</h1>
      <FaqEditor faqs={faqs} />
    </>
  )
}

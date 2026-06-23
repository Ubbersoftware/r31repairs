import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ServiceDetail } from '@/components/catalog/ServiceDetail'
import { getActiveServices, getServiceBySlug, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'

export const revalidate = 3600

export async function generateStaticParams() {
  const services = await getActiveServices()
  return services.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) return { title: 'Service not found — 31Repairs' }
  return {
    title: `${service.name} — 31Repairs`,
    description: service.description,
  }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [service, models, matrix] = await Promise.all([
    getServiceBySlug(slug),
    getActiveModels(),
    getPriceMatrix(),
  ])
  if (!service) notFound()

  return <ServiceDetail service={service} models={models} matrix={matrix} />
}

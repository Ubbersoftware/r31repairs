import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ServiceDetail } from '@/components/catalog/ServiceDetail'
import { SEED_SERVICES, SEED_MODELS } from '@/lib/catalog/seed'

export function generateStaticParams() {
  return SEED_SERVICES.filter((s) => s.active).map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const service = SEED_SERVICES.find((s) => s.slug === slug && s.active)
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
  const service = SEED_SERVICES.find((s) => s.slug === slug && s.active)
  if (!service) notFound()

  const models = SEED_MODELS.filter((m) => m.active)
  return <ServiceDetail service={service} models={models} />
}

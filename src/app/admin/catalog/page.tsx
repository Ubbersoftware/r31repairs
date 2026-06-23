import { getActiveServices, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'
import { PriceMatrixEditor } from '@/components/admin/PriceMatrixEditor'
import { ServiceEditorCard } from '@/components/admin/ServiceEditorCard'
import styles from './catalog.module.css'

export default async function AdminCatalogPage() {
  const [services, models, matrix] = await Promise.all([
    getActiveServices(),
    getActiveModels(),
    getPriceMatrix(),
  ])

  return (
    <>
      <p className="overline">Admin</p>
      <h1>Catalog</h1>

      <section className={styles.services}>
        {services.map((s) => (
          <ServiceEditorCard key={s.id} service={s} />
        ))}
      </section>

      <h2 className={styles.heading}>Pricing</h2>
      <PriceMatrixEditor services={services} models={models} matrix={matrix} />
    </>
  )
}

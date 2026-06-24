import type { Firestore } from 'firebase-admin/firestore'
import { SEED_SERVICES, SEED_MODELS, SEED_PRICES } from '@/lib/catalog/seed'
import { FAQ_SEED } from '@/lib/content/faq'
import { priceId } from '@/lib/catalog/ids'

type Row = { col: string; id: string; data: Record<string, unknown> }

function rows(): Row[] {
  const out: Row[] = []
  for (const s of SEED_SERVICES) out.push({ col: 'r31_services', id: s.id, data: { ...s, imageURL: null } })
  for (const m of SEED_MODELS) out.push({ col: 'r31_phoneModels', id: m.id, data: { ...m } })
  for (const p of SEED_PRICES) {
    const id = priceId(p.serviceSlug, p.modelId, p.variant)
    out.push({
      col: 'r31_prices', id,
      data: { serviceId: p.serviceSlug, modelId: p.modelId, variant: p.variant, amount: p.amount, available: p.available },
    })
  }
  for (const f of FAQ_SEED) out.push({ col: 'r31_faqs', id: f.id, data: { ...f } })
  return out
}

export async function seedCatalog(
  db: Firestore, opts: { force?: boolean } = {},
): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0
  for (const r of rows()) {
    const ref = db.collection(r.col).doc(r.id)
    if (!opts.force) {
      const existing = await ref.get()
      if (existing.exists) { skipped++; continue }
    }
    await ref.set(r.data)
    created++
  }
  return { created, skipped }
}

// CLI entry: `npm run seed:catalog` (add `-- --force` to overwrite).
// Builds the Admin SDK Firestore directly rather than importing `@/lib/firebase/admin`,
// which carries an `import 'server-only'` guard that throws outside a React Server
// Component (i.e. under plain `tsx`/Node, as this script runs).
if (process.argv[1] && process.argv[1].endsWith('seedCatalog.ts')) {
  const run = async () => {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
    if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or invalid (set it to the service-account JSON)')
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) })
    const force = process.argv.includes('--force')
    const r = await seedCatalog(getFirestore(app), { force })
    console.log(`Seed complete: created ${r.created}, skipped ${r.skipped}${force ? ' (force)' : ''}`)
  }
  run().catch((e) => { console.error(e); process.exit(1) })
}

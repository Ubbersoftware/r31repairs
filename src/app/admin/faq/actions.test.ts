import { describe, it, expect, vi, beforeEach } from 'vitest'
const revalidated: string[] = []
const sets: Record<string, unknown>[] = []
let lastDeletedId = ''

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error('FORBIDDEN'); return { uid: 'o1' } },
  getAdminDb: () => ({
    collection: () => ({
      doc: (id?: string) => ({ id: id ?? 'gen-id', set: async (d: Record<string, unknown>) => { sets.push(d) }, delete: async () => { lastDeletedId = id ?? '' } }),
    }),
    batch: () => ({ update: () => {}, commit: async () => {} }),
  }),
}))
beforeEach(() => { revalidated.length = 0; sets.length = 0; lastDeletedId = '' })

describe('faq actions', () => {
  it('saveFaqAction writes and revalidates /faq', async () => {
    const { saveFaqAction } = await import('./actions')
    const r = await saveFaqAction('owner', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 })
    expect(r).toEqual({ ok: true })
    expect(sets.length).toBe(1)
    expect(revalidated).toContain('/faq')
  })
  it('rejects a non-owner', async () => {
    const { saveFaqAction } = await import('./actions')
    expect(await saveFaqAction('nope', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 })).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('deleteFaqAction deletes by id', async () => {
    const { deleteFaqAction } = await import('./actions')
    expect(await deleteFaqAction('owner', 'faq-3')).toEqual({ ok: true })
    expect(lastDeletedId).toBe('faq-3')
  })
})

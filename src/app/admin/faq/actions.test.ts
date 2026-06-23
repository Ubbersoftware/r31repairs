import { describe, it, expect, vi, beforeEach } from 'vitest'
const revalidated: string[] = []
const sets: Record<string, unknown>[] = []
let lastDeletedId = ''
const batchUpdates: { id: string; data: Record<string, unknown> }[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error('FORBIDDEN'); return { uid: 'o1' } },
  getAdminDb: () => ({
    collection: () => ({
      doc: (id?: string) => ({ id: id ?? 'gen-id', set: async (d: Record<string, unknown>) => { sets.push(d) }, delete: async () => { lastDeletedId = id ?? '' } }),
    }),
    batch: () => ({
      update: (ref: { id: string }, data: Record<string, unknown>) => { batchUpdates.push({ id: ref.id, data }) },
      commit: async () => {},
    }),
  }),
}))
beforeEach(() => { revalidated.length = 0; sets.length = 0; lastDeletedId = ''; batchUpdates.length = 0 })

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
  it('deleteFaqAction rejects empty id', async () => {
    const { deleteFaqAction } = await import('./actions')
    expect(await deleteFaqAction('owner', '')).toEqual({ ok: false, error: 'INVALID' })
  })
  it('reorderFaqAction sets sortOrder and revalidates /faq', async () => {
    const { reorderFaqAction } = await import('./actions')
    const r = await reorderFaqAction('owner', ['a', 'b', 'c'])
    expect(r).toEqual({ ok: true })
    expect(revalidated).toContain('/faq')
    expect(batchUpdates).toHaveLength(3)
    expect(batchUpdates[0]).toEqual({ id: 'a', data: { sortOrder: 1 } })
    expect(batchUpdates[1]).toEqual({ id: 'b', data: { sortOrder: 2 } })
    expect(batchUpdates[2]).toEqual({ id: 'c', data: { sortOrder: 3 } })
  })
  it('reorderFaqAction rejects a non-owner', async () => {
    const { reorderFaqAction } = await import('./actions')
    expect(await reorderFaqAction('nope', ['a'])).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
})

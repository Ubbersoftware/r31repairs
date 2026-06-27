// src/app/admin/settings/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let stored: Record<string, unknown> = {}
const revalidated: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => {
    if (t !== 'owner') throw new Error('FORBIDDEN')
    return { uid: 'o1' }
  },
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        set: async (_d: Record<string, unknown>, _opts: unknown) => { stored = { ...stored, ..._d } },
      }),
    }),
  }),
}))

const validInput = {
  name: '31 Repairs', address: '123 Main', mapURL: '', phone: '71234567',
  instagram: '@31repairs', logoURL: null,
  paymentChannels: [{ id: 'bank_transfer', label: 'Bank', payToLabel: 'Account', details: 'FNB' }],
  warrantyMonths: 3,
}

beforeEach(() => { stored = {}; revalidated.length = 0 })

describe('updateSettingsAction', () => {
  it('rejects non-owner', async () => {
    const { updateSettingsAction } = await import('./actions')
    expect(await updateSettingsAction('cust', validInput)).toMatchObject({ ok: false })
  })
  it('rejects invalid input', async () => {
    const { updateSettingsAction } = await import('./actions')
    expect(await updateSettingsAction('owner', { ...validInput, name: '' })).toMatchObject({ ok: false })
  })
  it('saves settings with updatedAt + updatedBy', async () => {
    const { updateSettingsAction } = await import('./actions')
    const r = await updateSettingsAction('owner', validInput)
    expect(r).toEqual({ ok: true })
    expect(stored.name).toBe('31 Repairs')
    expect(stored.updatedBy).toBe('o1')
    expect(stored.updatedAt).toBeTypeOf('number')
  })
  it('revalidates settings + root paths', async () => {
    const { updateSettingsAction } = await import('./actions')
    await updateSettingsAction('owner', validInput)
    expect(revalidated).toContain('/admin/settings')
    expect(revalidated).toContain('/')
  })
})

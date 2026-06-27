import { describe, it, beforeAll, afterAll } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-r31',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'r31_settings/shop'), { name: '31 Repairs', warrantyMonths: 3 })
  })
})
afterAll(async () => { await env.cleanup() })

describe('r31_settings — read (public)', () => {
  it('allows unauthenticated read', async () => {
    const ctx = env.unauthenticatedContext()
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_settings/shop')))
  })
  it('allows customer read', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_settings/shop')))
  })
  it('allows owner read', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_settings/shop')))
  })
})

describe('r31_settings — write (must be denied to all clients)', () => {
  it('denies client write — owner', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_settings/shop'), { name: 'Hacked', warrantyMonths: 99 }))
  })
  it('denies client write — customer', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_settings/shop'), { name: 'Hacked' }))
  })
  it('denies client write — unauthenticated', async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_settings/shop'), { name: 'Hacked' }))
  })
})

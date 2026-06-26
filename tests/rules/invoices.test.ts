import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
    await setDoc(doc(ctx.firestore(), 'r31_invoices/inv1'), { customerId: 'c1', orderId: 'o1', status: 'issued' })
  })
})
afterAll(async () => { await env.cleanup() })

describe('r31_invoices rules', () => {
  it('lets the owning customer read their invoice', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('denies another customer', async () => {
    const ctx = env.authenticatedContext('c2')
    await assertFails(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('lets an owner read', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('denies all client writes (even owner)', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_invoices/inv2'), { customerId: 'c1', orderId: 'o1', status: 'draft' }))
  })
})

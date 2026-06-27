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
    const db = ctx.firestore()
    await setDoc(doc(db, 'r31_warranties/w1'), { customerId: 'c1', status: 'active', endDate: 9999999999999 })
    await setDoc(doc(db, 'r31_warranties/w1/claims/cl1'), { warrantyId: 'w1', customerId: 'c1', status: 'received' })
  })
})
afterAll(async () => { await env.cleanup() })

describe('r31_warranties — read', () => {
  it('lets the owning customer read their warranty', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_warranties/w1')))
  })
  it('denies a different customer', async () => {
    const ctx = env.authenticatedContext('c2')
    await assertFails(getDoc(doc(ctx.firestore(), 'r31_warranties/w1')))
  })
  it('lets an owner read any warranty', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_warranties/w1')))
  })
  it('denies unauthenticated read', async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(getDoc(doc(ctx.firestore(), 'r31_warranties/w1')))
  })
})

describe('r31_warranties — write (must be denied to all clients)', () => {
  it('denies client write — owning customer', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w2'), { customerId: 'c1', status: 'active' }))
  })
  it('denies client write — owner', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w2'), { customerId: 'c1', status: 'active' }))
  })
  it('denies client write — unauthenticated', async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w2'), { customerId: 'c1', status: 'active' }))
  })
})

describe('r31_warranties/{id}/claims — read', () => {
  it('lets the owning customer read their claim', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl1')))
  })
  it('denies a different customer reading claims', async () => {
    const ctx = env.authenticatedContext('c2')
    await assertFails(getDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl1')))
  })
  it('lets an owner read claims', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl1')))
  })
})

describe('r31_warranties/{id}/claims — write (must be denied to all clients)', () => {
  it('denies client write — owning customer', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl2'), { warrantyId: 'w1', status: 'received' }))
  })
  it('denies client write — owner', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl2'), { warrantyId: 'w1', status: 'assessing' }))
  })
  it('denies client write — unauthenticated', async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_warranties/w1/claims/cl2'), { warrantyId: 'w1', status: 'received' }))
  })
})

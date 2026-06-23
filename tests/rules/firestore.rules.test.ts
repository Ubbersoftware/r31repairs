import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'r31-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('firestore rules', () => {
  it('lets anyone read services', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(db, 'r31_services/svc1')))
  })

  it('blocks a customer from writing services', async () => {
    const db = env.authenticatedContext('cust', { role: 'customer' }).firestore()
    await assertFails(setDoc(doc(db, 'r31_services/svc1'), { name: 'x' }))
  })

  it('lets an owner write services', async () => {
    const db = env.authenticatedContext('own', { role: 'owner' }).firestore()
    await assertSucceeds(setDoc(doc(db, 'r31_services/svc1'), { name: 'Battery' }))
  })

  it('lets a user create their own customer profile but not as owner', async () => {
    const db = env.authenticatedContext('me').firestore()
    await assertSucceeds(setDoc(doc(db, 'r31_users/me'), { role: 'customer', email: 'a@b.com' }))
    await assertFails(setDoc(doc(db, 'r31_users/me2'), { role: 'customer' }))
    await assertFails(setDoc(doc(db, 'r31_users/me3'), { role: 'owner' }))
  })

  it('stops a customer reading another customer order', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'r31_orders/o1'), { customerId: 'other' })
    })
    const db = env.authenticatedContext('cust', { role: 'customer' }).firestore()
    await assertFails(getDoc(doc(db, 'r31_orders/o1')))
  })

  it('lets a customer read their own order', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'r31_orders/o2'), { customerId: 'cust' })
    })
    const db = env.authenticatedContext('cust', { role: 'customer' }).firestore()
    await assertSucceeds(getDoc(doc(db, 'r31_orders/o2')))
  })
})

describe('catalog rules', () => {
  it('anyone can read services, nobody-but-owner can write', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'services/screen')))
    await assertFails(setDoc(doc(anon, 'services/screen'), { name: 'x' }))

    const customer = env.authenticatedContext('c1', { role: 'customer' }).firestore()
    await assertFails(
      setDoc(doc(customer, 'prices/battery__iphone-13__none'), { amount: 1 }),
    )

    const owner = env.authenticatedContext('o1', { role: 'owner' }).firestore()
    await assertSucceeds(
      setDoc(doc(owner, 'prices/battery__iphone-13__none'), {
        amount: 1,
        serviceId: 'battery',
        modelId: 'iphone-13',
        variant: null,
        available: true,
      }),
    )
  })

  it('faqs are public-read, owner-write', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'faqs/faq-1')))
    await assertFails(setDoc(doc(anon, 'faqs/faq-1'), { question: 'x' }))

    const owner = env.authenticatedContext('o1', { role: 'owner' }).firestore()
    await assertSucceeds(
      setDoc(doc(owner, 'faqs/faq-1'), {
        question: 'q',
        answer: 'a',
        category: 'general',
        active: true,
        sortOrder: 1,
      }),
    )
  })
})

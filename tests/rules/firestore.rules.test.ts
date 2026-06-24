import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

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

describe('orders + events rules', () => {
  it('orders: customer reads only their own; owner reads all; client cannot write', async () => {
    await env.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'r31_orders/o1'), { customerId: 'c1', status: 'placed' })
      await setDoc(
        doc(admin.firestore(), 'r31_orders/o1/events/e1'),
        { visibility: 'customer', type: 'created' },
      )
      await setDoc(
        doc(admin.firestore(), 'r31_orders/o1/events/e2'),
        { visibility: 'internal', type: 'note' },
      )
    })
    const c1 = env.authenticatedContext('c1', { role: 'customer' }).firestore()
    const c2 = env.authenticatedContext('c2', { role: 'customer' }).firestore()
    const owner = env.authenticatedContext('o1', { role: 'owner' }).firestore()
    // customer reads own order
    await assertSucceeds(getDoc(doc(c1, 'r31_orders/o1')))
    // another customer is denied
    await assertFails(getDoc(doc(c2, 'r31_orders/o1')))
    // owner reads all
    await assertSucceeds(getDoc(doc(owner, 'r31_orders/o1')))
    // client write denied
    await assertFails(setDoc(doc(c1, 'r31_orders/o1'), { status: 'ready' }))
    // customer reads customer-visible event
    await assertSucceeds(getDoc(doc(c1, 'r31_orders/o1/events/e1')))
    // internal event is owner-only — denied to customer
    await assertFails(getDoc(doc(c1, 'r31_orders/o1/events/e2')))
  })
})

describe('catalog rules', () => {
  it('anyone can read services, nobody-but-owner can write', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'r31_services/screen')))
    await assertFails(setDoc(doc(anon, 'r31_services/screen'), { name: 'x' }))

    const customer = env.authenticatedContext('c1', { role: 'customer' }).firestore()
    await assertFails(
      setDoc(doc(customer, 'r31_prices/battery__iphone-13__none'), { amount: 1 }),
    )

    const owner = env.authenticatedContext('o1', { role: 'owner' }).firestore()
    await assertSucceeds(
      setDoc(doc(owner, 'r31_prices/battery__iphone-13__none'), {
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
    await assertSucceeds(getDoc(doc(anon, 'r31_faqs/faq-1')))
    await assertFails(setDoc(doc(anon, 'r31_faqs/faq-1'), { question: 'x' }))

    const owner = env.authenticatedContext('o1', { role: 'owner' }).firestore()
    await assertSucceeds(
      setDoc(doc(owner, 'r31_faqs/faq-1'), {
        question: 'q',
        answer: 'a',
        category: 'general',
        active: true,
        sortOrder: 1,
      }),
    )
  })
})

describe('notifications rules', () => {
  it('notifications: own read, read-flag-only update, no client create', async () => {
    await env.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'r31_notifications/n1'), {
        userId: 'c1',
        type: 'status_change',
        title: 'R31-0001',
        body: 'Status: In Repair',
        link: '/orders/o1',
        read: false,
        createdAt: 1,
      })
    })
    const c1 = env.authenticatedContext('c1', { role: 'customer' }).firestore()
    const c2 = env.authenticatedContext('c2', { role: 'customer' }).firestore()
    await assertSucceeds(getDoc(doc(c1, 'r31_notifications/n1')))
    await assertFails(getDoc(doc(c2, 'r31_notifications/n1')))                           // not your notification
    await assertSucceeds(updateDoc(doc(c1, 'r31_notifications/n1'), { read: true }))     // mark read OK
    await assertFails(updateDoc(doc(c1, 'r31_notifications/n1'), { title: 'hacked' }))   // only read may change
    await assertFails(setDoc(doc(c1, 'r31_notifications/n2'), { userId: 'c1', read: false })) // client create denied
  })
})

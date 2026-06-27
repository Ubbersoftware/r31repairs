import { describe, it, expect } from 'vitest'
import { claimRaiseSchema, claimUpdateSchema } from './validation'

describe('claimRaiseSchema', () => {
  it('accepts valid input', () => {
    expect(claimRaiseSchema.safeParse({ description: 'broken', photoURLs: [] }).success).toBe(true)
  })
  it('rejects empty description', () => {
    expect(claimRaiseSchema.safeParse({ description: '', photoURLs: [] }).success).toBe(false)
  })
  it('rejects description over 1000 chars', () => {
    expect(claimRaiseSchema.safeParse({ description: 'x'.repeat(1001), photoURLs: [] }).success).toBe(false)
  })
  it('rejects more than 6 photos', () => {
    expect(claimRaiseSchema.safeParse({ description: 'ok', photoURLs: Array(7).fill('https://x.com/a.png') }).success).toBe(false)
  })
  it('accepts up to 6 photos', () => {
    expect(claimRaiseSchema.safeParse({ description: 'ok', photoURLs: Array(6).fill('https://x.com/a.png') }).success).toBe(true)
  })
})

describe('claimUpdateSchema', () => {
  it('accepts valid status + null notes', () => {
    expect(claimUpdateSchema.safeParse({ status: 'assessing', adminNotes: null }).success).toBe(true)
  })
  it('accepts valid status + string notes', () => {
    expect(claimUpdateSchema.safeParse({ status: 'resolved', adminNotes: 'fixed' }).success).toBe(true)
  })
  it('rejects unknown status', () => {
    expect(claimUpdateSchema.safeParse({ status: 'pending', adminNotes: null }).success).toBe(false)
  })
})

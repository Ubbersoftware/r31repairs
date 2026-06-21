import { describe, it, expect } from 'vitest'
import { toThebe, fromThebe, formatPula } from './money'

describe('money', () => {
  it('converts pula to thebe', () => { expect(toThebe(500)).toBe(50000) })
  it('rounds half-thebe correctly', () => { expect(toThebe(500.005)).toBe(50001) })
  it('converts thebe to pula', () => { expect(fromThebe(50000)).toBe(500) })
  it('formats whole amounts with grouping and no decimals', () => {
    expect(formatPula(120000)).toBe('P1,200')
    expect(formatPula(50000)).toBe('P500')
  })
  it('formats fractional amounts with two decimals', () => {
    expect(formatPula(50050)).toBe('P500.50')
  })
})

import { describe, it, expect } from 'vitest'
import { smoke } from './smoke'

describe('smoke', () => {
  it('reports ready', () => {
    expect(smoke()).toBe('ready')
  })
})

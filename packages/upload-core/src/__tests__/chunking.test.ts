import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, calculateTotalChunks, getRetryDelay } from '../chunking.js'

describe('calculateTotalChunks', () => {
  it('returns 1 for an empty file', () => {
    expect(calculateTotalChunks(0)).toBe(1)
  })

  it('returns 1 for a file exactly equal to CHUNK_SIZE', () => {
    expect(calculateTotalChunks(CHUNK_SIZE)).toBe(1)
  })

  it('returns 2 for a file one byte over CHUNK_SIZE', () => {
    expect(calculateTotalChunks(CHUNK_SIZE + 1)).toBe(2)
  })

  it('returns the correct count for a multi-chunk file', () => {
    expect(calculateTotalChunks(CHUNK_SIZE * 5)).toBe(5)
    expect(calculateTotalChunks(CHUNK_SIZE * 5 + 1)).toBe(6)
  })

  it('returns -0 for negative file sizes (documents current behaviour)', () => {
    // Math.ceil(-1 / CHUNK_SIZE) = -0 — callers should guard against negative sizes
    expect(calculateTotalChunks(-1)).toBe(-0)
  })
})

describe('getRetryDelay', () => {
  it('returns 1s on the first retry attempt', () => {
    expect(getRetryDelay(1)).toBe(1000)
  })

  it('doubles the delay on each subsequent attempt (exponential backoff)', () => {
    expect(getRetryDelay(2)).toBe(2000)
    expect(getRetryDelay(3)).toBe(4000)
    expect(getRetryDelay(4)).toBe(8000)
  })

  it('caps the delay at 30 seconds', () => {
    expect(getRetryDelay(10)).toBe(30_000)
    expect(getRetryDelay(100)).toBe(30_000)
  })

  it('attempt 0 returns 500 ms (half the base, documents current behaviour)', () => {
    // Math.pow(2, 0 - 1) = 0.5 → 1000 * 0.5 = 500
    expect(getRetryDelay(0)).toBe(500)
  })
})

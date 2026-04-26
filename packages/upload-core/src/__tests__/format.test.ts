import { describe, it, expect } from 'vitest'
import {
  formatFileSize,
  formatDuration,
  formatSpeed,
  formatDate,
} from '../format.js'

// ── formatFileSize ─────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes without decimal (i === 0)', () => {
    expect(formatFileSize(1)).toBe('1 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('formats exactly 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formats fractional kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats exactly 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('formats fractional megabytes', () => {
    expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe('1.5 MB')
  })

  it('formats exactly 1 GB', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  it('formats exactly 1 TB', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
  })

  it('caps at TB for very large values', () => {
    // 2 PB — index clamped to TB (units.length - 1 = 4)
    const twoPB = 2 * 1024 * 1024 * 1024 * 1024 * 1024
    expect(formatFileSize(twoPB)).toMatch(/TB$/)
  })
})

// ── formatDuration ─────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "0s" for zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('floors sub-second durations to 0s', () => {
    expect(formatDuration(500)).toBe('0s')
    expect(formatDuration(999)).toBe('0s')
  })

  it('formats whole seconds under one minute', () => {
    expect(formatDuration(1_000)).toBe('1s')
    expect(formatDuration(59_000)).toBe('59s')
  })

  it('formats exactly 60 seconds as 1m 0s', () => {
    expect(formatDuration(60_000)).toBe('1m 0s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s')
    expect(formatDuration(125_000)).toBe('2m 5s')
  })

  it('formats large durations in minutes (no hours unit)', () => {
    expect(formatDuration(3_600_000)).toBe('60m 0s')
  })
})

// ── formatSpeed ────────────────────────────────────────────────────────────────

describe('formatSpeed', () => {
  it('formats 0 B/s', () => {
    expect(formatSpeed(0)).toBe('0 B/s')
  })

  it('formats values under 1 KB/s as B/s (rounded)', () => {
    expect(formatSpeed(512)).toBe('512 B/s')
    expect(formatSpeed(1023)).toBe('1023 B/s')
    expect(formatSpeed(100.6)).toBe('101 B/s')
  })

  it('formats exactly 1 KB/s', () => {
    expect(formatSpeed(1024)).toBe('1.0 KB/s')
  })

  it('formats fractional KB/s', () => {
    expect(formatSpeed(1536)).toBe('1.5 KB/s')
  })

  it('formats exactly 1 MB/s', () => {
    expect(formatSpeed(1024 * 1024)).toBe('1.0 MB/s')
  })

  it('formats fractional MB/s', () => {
    expect(formatSpeed(5.5 * 1024 * 1024)).toBe('5.5 MB/s')
  })

  it('formats large speeds as MB/s', () => {
    expect(formatSpeed(100 * 1024 * 1024)).toBe('100.0 MB/s')
  })
})

// ── formatDate ─────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2024-06-15T10:30:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the year in the formatted output', () => {
    const result = formatDate('2024-06-15T10:30:00.000Z')
    expect(result).toContain('2024')
  })

  it('returns "Invalid Date" for a malformed ISO string', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date')
  })
})
import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-10T12:00:00Z').getTime()

  it('reports under a minute as "just now"', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now')
  })

  it('reports minutes', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago')
  })

  it('reports hours', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago')
  })

  it('reports days', () => {
    expect(formatRelativeTime(now - 4 * 24 * 60 * 60_000, now)).toBe('4d ago')
  })

  it('falls back to a short date past 30 days', () => {
    const timestamp = new Date('2026-05-01T12:00:00Z').getTime()
    expect(formatRelativeTime(timestamp, now)).toBe('May 1')
  })
})

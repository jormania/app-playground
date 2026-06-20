import { describe, it, expect } from 'vitest'
import { todayKey, walkToday, nextCallTime, buildMessage } from './dailyCall.js'

describe('todayKey', () => {
  it('formats local YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 5, 9, 13, 0))).toBe('2026-06-09')
  })
})

describe('walkToday', () => {
  const now = new Date(2026, 5, 20, 18, 0)
  it('finds a walk taken today', () => {
    const hist = [{ ts: new Date(2026, 5, 20, 9, 0).getTime(), discovery: { name: 'The Ninefold Shadow' } }]
    expect(walkToday(hist, now)).toBe(hist[0])
  })
  it('ignores walks from other days', () => {
    const hist = [{ ts: new Date(2026, 5, 19, 9, 0).getTime(), discovery: { name: 'Yesterday' } }]
    expect(walkToday(hist, now)).toBe(null)
  })
  it('handles empty / missing history', () => {
    expect(walkToday([], now)).toBe(null)
    expect(walkToday(null, now)).toBe(null)
  })
})

describe('nextCallTime', () => {
  it('is two hours before sunset with coordinates', () => {
    const date = new Date(Date.UTC(2026, 2, 20, 12))
    const call = nextCallTime(date, { lat: 0, lon: 0 }) // equinox equator: sunset ~18:00 UTC
    const hourUTC = call.getUTCHours()
    expect(hourUTC).toBeGreaterThanOrEqual(15)
    expect(hourUTC).toBeLessThanOrEqual(16)
  })
  it('falls back to a late-afternoon clock time without coordinates', () => {
    const call = nextCallTime(new Date(2026, 5, 20, 9, 0), null)
    expect(call.getHours()).toBe(16)
    expect(call.getMinutes()).toBe(30)
  })
})

describe('buildMessage', () => {
  it('nudges when no walk yet today', () => {
    const msg = buildMessage(null)
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })
  it('acknowledges and may name the find when walked', () => {
    const msg = buildMessage({ discovery: { name: 'The Listening Stone' } })
    expect(typeof msg).toBe('string')
    // at least one of the walked templates names the find; all are non-empty
    expect(msg.length).toBeGreaterThan(0)
  })
  it('still works when a walk has no find name', () => {
    expect(typeof buildMessage({})).toBe('string')
  })
})

import { test, expect, vi, afterEach } from 'vitest'
import { haptic } from './haptics.js'

afterEach(() => { vi.unstubAllGlobals() })

test('calls navigator.vibrate when available', () => {
  const vibrate = vi.fn()
  vi.stubGlobal('navigator', { vibrate })
  haptic(20)
  expect(vibrate).toHaveBeenCalledWith(20)
})

test('defaults to a short pulse', () => {
  const vibrate = vi.fn()
  vi.stubGlobal('navigator', { vibrate })
  haptic()
  expect(vibrate).toHaveBeenCalledWith(12)
})

test('does not throw when navigator.vibrate is missing', () => {
  vi.stubGlobal('navigator', {})
  expect(() => haptic()).not.toThrow()
})

test('does not throw when vibrate itself throws (blocked/unsupported)', () => {
  vi.stubGlobal('navigator', { vibrate: () => { throw new Error('blocked') } })
  expect(() => haptic()).not.toThrow()
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readJson,
  writeJson,
  removeJson,
  readSessionJson,
  writeSessionJson,
  removeSessionJson,
} from './storage'

// The module's promise is that it cannot throw. These pin the defensive half
// (the catches, the missing binding, the null fallback), not the round-trip.

const flavours = [
  {
    name: 'localStorage',
    store: 'localStorage' as const,
    read: readJson,
    write: writeJson,
    remove: removeJson,
  },
  {
    name: 'sessionStorage',
    store: 'sessionStorage' as const,
    read: readSessionJson,
    write: writeSessionJson,
    remove: removeSessionJson,
  },
]

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe.each(flavours)('$name helpers', ({ store, read, write, remove }) => {
  it('round-trips a value', () => {
    expect(write('k', { a: [1, 2] })).toBe(true)
    expect(read('k', null)).toEqual({ a: [1, 2] })
    remove('k')
    expect(read('k', 'gone')).toBe('gone')
  })

  it('reads the fallback for a missing key', () => {
    expect(read('absent', 42)).toBe(42)
  })

  it('reads the fallback for malformed JSON instead of throwing', () => {
    window[store].setItem('bad', '{not json')
    expect(read('bad', 'fb')).toBe('fb')
  })

  it('reads a stored literal null as the fallback', () => {
    window[store].setItem('n', 'null')
    expect(read('n', { d: 1 })).toEqual({ d: 1 })
  })

  it('returns false rather than throwing when setItem throws (quota / private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(write('k', 1)).toBe(false)
  })

  it('returns false when the value cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(write('k', cyclic)).toBe(false)
  })

  it('swallows a throw from removeItem', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => remove('k')).not.toThrow()
  })

  it('swallows a throw from getItem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(read('k', 'fb')).toBe('fb')
  })

  it('degrades when the binding is missing', () => {
    vi.stubGlobal(store, undefined)
    expect(read('k', 'fb')).toBe('fb')
    expect(write('k', 1)).toBe(false)
    expect(() => remove('k')).not.toThrow()
  })

  it('degrades when the binding is null', () => {
    vi.stubGlobal(store, null)
    expect(read('k', 'fb')).toBe('fb')
    expect(write('k', 1)).toBe(false)
    expect(() => remove('k')).not.toThrow()
  })
})

describe('the two stores are independent', () => {
  it('does not cross-read', () => {
    writeJson('k', 1)
    expect(readSessionJson('k', 'none')).toBe('none')
  })
})

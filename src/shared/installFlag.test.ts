import { describe, it, expect, afterEach, vi } from 'vitest'
import { watchInstalled, isMarkedInstalled } from './installFlag'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
  }
}

describe('watchInstalled', () => {
  it('marks the file installed immediately when already running standalone', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage())
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
      addEventListener: () => {},
    })
    watchInstalled('tempo-react.html')
    expect(isMarkedInstalled('tempo-react.html')).toBe(true)
  })

  it('does not mark it installed just from being loaded in a normal tab', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage())
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
    })
    watchInstalled('tempo-react.html')
    expect(isMarkedInstalled('tempo-react.html')).toBe(false)
  })

  it('marks it installed once appinstalled fires', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage())
    let firedHandler: (() => void) | undefined
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      addEventListener: (name: string, handler: () => void) => {
        if (name === 'appinstalled') firedHandler = handler
      },
    })
    watchInstalled('tempo-react.html')
    expect(isMarkedInstalled('tempo-react.html')).toBe(false)
    firedHandler?.()
    expect(isMarkedInstalled('tempo-react.html')).toBe(true)
  })
})

describe('isMarkedInstalled', () => {
  it('is false when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(isMarkedInstalled('tempo-react.html')).toBe(false)
  })
})

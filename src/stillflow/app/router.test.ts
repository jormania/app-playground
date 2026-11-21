// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoute } from './router'

const frames = () => new Promise((r) => setTimeout(r, 40))
const hashChange = async (go: () => void) => {
  go()
  await new Promise((r) => setTimeout(r, 0))
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  await frames()
}

describe('scroll on navigation', () => {
  it('a new screen starts at the top; Back returns to where you were', async () => {
    window.history.replaceState(null, '', '#/')
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    renderHook(() => useRoute())

    // Scroll Today down, then tap a card that opens Explore.
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await hashChange(() => window.history.pushState(null, '', '#/explore'))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 })

    // Back to Today: the place is kept.
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await new Promise<void>((r) => { window.addEventListener('popstate', () => r(), { once: true }); window.history.back() })
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await frames()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 900 })

    // Today again, but from a link rather than Back: a new entry, so the top.
    await hashChange(() => window.history.pushState(null, '', '#/explore'))
    await hashChange(() => window.history.pushState(null, '', '#/'))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 })
  })
})

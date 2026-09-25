// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { morph } from './morph'

const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown }

describe('morph', () => {
  afterEach(() => {
    delete doc.startViewTransition
    vi.unstubAllGlobals()
  })

  it('makes the change at once where there are no view transitions', () => {
    const update = vi.fn()
    morph(update)
    expect(update).toHaveBeenCalledOnce()
  })

  it('makes it inside one view transition, a morph within it included', () => {
    const start = vi.fn((cb: () => void) => cb())
    doc.startViewTransition = start
    const inner = vi.fn()
    morph(() => morph(inner))
    expect(start).toHaveBeenCalledOnce()
    expect(inner).toHaveBeenCalledOnce()
  })

  it('skips the transition when the phone asks for less motion', () => {
    const start = vi.fn((cb: () => void) => cb())
    doc.startViewTransition = start
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    const update = vi.fn()
    morph(update)
    expect(update).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
  })
})

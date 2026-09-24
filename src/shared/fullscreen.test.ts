import { describe, expect, it, vi } from 'vitest'
import { fullscreenOnTap, wantsFullscreen, type FullscreenEnv } from './fullscreen'

function env(opts: { coarse?: boolean; displayMode?: string; enabled?: boolean; api?: boolean } = {}) {
  const { coarse = true, displayMode = 'browser', enabled = true, api = true } = opts
  const listeners = new Map<string, EventListener>()
  const requestFullscreen = vi.fn(() => {
    doc.fullscreenElement = {} as Element
    return Promise.resolve()
  })
  const doc = {
    fullscreenElement: null as Element | null,
    fullscreenEnabled: enabled,
    documentElement: { requestFullscreen: api ? requestFullscreen : undefined },
    addEventListener: vi.fn((type: string, l: EventListener) => listeners.set(type, l)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  }
  const e = {
    doc,
    matchMedia: (q: string) => ({
      matches: q === '(pointer: coarse)' ? coarse : q === `(display-mode: ${displayMode})`,
    }),
  } as unknown as FullscreenEnv
  const tap = () => listeners.get('click')?.(new Event('click'))
  return { e, doc, requestFullscreen, tap, listeners }
}

describe('wantsFullscreen', () => {
  it('applies to a touch device in a browser tab or shortcut', () => {
    expect(wantsFullscreen(env().e)).toBe(true)
  })

  it("applies to Chrome's manifest-less installs, which run minimal-ui with a toolbar", () => {
    expect(wantsFullscreen(env({ displayMode: 'minimal-ui' }).e)).toBe(true)
  })

  it('leaves an installed app alone', () => {
    expect(wantsFullscreen(env({ displayMode: 'standalone' }).e)).toBe(false)
    expect(wantsFullscreen(env({ displayMode: 'fullscreen' }).e)).toBe(false)
  })

  it('leaves a desktop alone', () => {
    expect(wantsFullscreen(env({ coarse: false }).e)).toBe(false)
  })

  it('does nothing without the Fullscreen API, as on iPhone Safari', () => {
    expect(wantsFullscreen(env({ enabled: false }).e)).toBe(false)
    expect(wantsFullscreen(env({ api: false }).e)).toBe(false)
  })
})

describe('fullscreenOnTap', () => {
  it('enters full screen on a tap, with the navigation UI hidden', () => {
    const { e, requestFullscreen, tap } = env()
    fullscreenOnTap(e)
    expect(requestFullscreen).not.toHaveBeenCalled()
    tap()
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
  })

  it('does not ask again while already full screen, and asks again once out of it', () => {
    const { e, doc, requestFullscreen, tap } = env()
    fullscreenOnTap(e)
    tap()
    tap()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    doc.fullscreenElement = null // the back gesture, or switching apps
    tap()
    expect(requestFullscreen).toHaveBeenCalledTimes(2)
  })

  it('listens in the capture phase, so a handler that stops propagation cannot swallow the tap', () => {
    const { e, doc } = env()
    fullscreenOnTap(e)
    expect(doc.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), true)
  })

  it('stops listening when told to', () => {
    const { e, listeners } = env()
    const stop = fullscreenOnTap(e)
    stop()
    expect(listeners.has('click')).toBe(false)
  })

  it('never listens where it does not apply', () => {
    const { e, doc } = env({ displayMode: 'standalone' })
    fullscreenOnTap(e)
    expect(doc.addEventListener).not.toHaveBeenCalled()
  })

  it('swallows a refused request rather than throwing', async () => {
    const { e, doc, tap } = env()
    doc.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
    fullscreenOnTap(e)
    expect(() => tap()).not.toThrow()
    await Promise.resolve()
  })
})

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { exercises } from './exercises.js'
import App from './App.jsx'

// R-009, second slice: the render tree and the scroll-spy that exercises.test.js
// left alone. The app's only state is `active`, set by an IntersectionObserver
// watching the cards; the nav chip with that id carries the `active` class.

let observers

beforeEach(() => {
  observers = []
  window.IntersectionObserver = class {
    constructor(cb, options) {
      this.cb = cb
      this.options = options
      this.observed = []
      this.disconnected = false
      observers.push(this)
    }
    observe(el) { this.observed.push(el) }
    disconnect() { this.disconnected = true }
  }
  // Nav recentres the active chip with rail.scrollTo, which happy-dom lacks.
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  delete window.IntersectionObserver
})

const activeChips = (container) => [...container.querySelectorAll('.chip.active')]

describe('Kettlebell App', () => {
  it('renders one card and one nav chip per exercise, linked by id', () => {
    const { container } = render(<App />)
    expect(container.querySelectorAll('article.card')).toHaveLength(exercises.length)
    const chips = [...container.querySelectorAll('a.chip')]
    expect(chips).toHaveLength(exercises.length)
    for (const ex of exercises) {
      expect(container.querySelector(`#ex-${ex.id}`)).not.toBeNull()
      expect(chips.some((c) => c.getAttribute('href') === `#ex-${ex.id}`)).toBe(true)
    }
  })

  it('starts with the first exercise highlighted', () => {
    const { container } = render(<App />)
    const active = activeChips(container)
    expect(active).toHaveLength(1)
    expect(active[0].dataset.id).toBe(exercises[0].id)
  })

  it('observes every card and moves the highlight to the one that intersects', () => {
    const { container } = render(<App />)
    expect(observers).toHaveLength(1)
    const [obs] = observers
    expect(obs.observed).toHaveLength(exercises.length)

    const target = exercises[exercises.length - 1]
    act(() => {
      obs.cb([{ isIntersecting: true, target: container.querySelector(`#ex-${target.id}`) }])
    })
    const active = activeChips(container)
    expect(active).toHaveLength(1)
    expect(active[0].dataset.id).toBe(target.id)
  })

  it('ignores cards leaving the band', () => {
    const { container } = render(<App />)
    const [obs] = observers
    act(() => {
      obs.cb([{ isIntersecting: false, target: container.querySelector(`#ex-${exercises[3].id}`) }])
    })
    expect(activeChips(container)[0].dataset.id).toBe(exercises[0].id)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<App />)
    unmount()
    expect(observers[0].disconnected).toBe(true)
  })

  it('renders without an IntersectionObserver', () => {
    delete window.IntersectionObserver
    const { container } = render(<App />)
    expect(container.querySelectorAll('article.card')).toHaveLength(exercises.length)
  })
})

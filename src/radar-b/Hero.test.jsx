// @vitest-environment happy-dom
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { act } from 'react'
import { Hero, heroUrl } from './Hero.jsx'

afterEach(cleanup)

const img = (c) => c.container.querySelector('img.detailHero')

/** A failed image, as the browser reports one. happy-dom never fetches, so the
 *  only way to reach `onError` is to fire it — which is also exactly what a
 *  `content-type: text/html` body arriving at an `<img>` does in a real one. */
const fail = (el) => act(() => { el.dispatchEvent(new Event('error')) })

describe('heroUrl', () => {
  test('the first attempt is the URL untouched, so a working picture stays cacheable', () => {
    expect(heroUrl('https://a.ro/p.jpg', 0)).toBe('https://a.ro/p.jpg')
  })

  test('a retry busts the cache, or the browser re-serves the failure for free', () => {
    expect(heroUrl('https://a.ro/p.jpg', 1)).toBe('https://a.ro/p.jpg?rb-retry=1')
    expect(heroUrl('https://a.ro/p.jpg', 2)).toBe('https://a.ro/p.jpg?rb-retry=2')
  })

  test('appends to a query the source already put there', () => {
    expect(heroUrl('https://a.ro/p.jpg?w=800', 1)).toBe('https://a.ro/p.jpg?w=800&rb-retry=1')
  })

  test('no source, nothing to ask for', () => {
    expect(heroUrl(null, 2)).toBe(null)
    expect(heroUrl('', 1)).toBe('')
  })
})

describe('Hero', () => {
  test('renders the picture a Radar row carries', () => {
    const c = render(<Hero src="https://a.ro/p.jpg" />)
    expect(img(c).getAttribute('src')).toBe('https://a.ro/p.jpg')
  })

  test('a row without an Image draws nothing at all', () => {
    const c = render(<Hero src={null} />)
    expect(img(c)).toBe(null)
  })

  test('asks again after an interstitial, rather than giving up on one answer', () => {
    const c = render(<Hero src="https://modernism.ro/p.jpg" />)
    fail(img(c))
    expect(img(c).getAttribute('src')).toBe('https://modernism.ro/p.jpg?rb-retry=1')
    fail(img(c))
    expect(img(c).getAttribute('src')).toBe('https://modernism.ro/p.jpg?rb-retry=2')
  })

  test('three refusals and the hero leaves — no empty box above the name', () => {
    const c = render(<Hero src="https://modernism.ro/p.jpg" />)
    fail(img(c)); fail(img(c)); fail(img(c))
    expect(img(c)).toBe(null)
  })

  test('does not hand one event exhaustion to the next', () => {
    // EventDetail is mounted unkeyed, so this instance survives the close/open.
    const c = render(<Hero src="https://modernism.ro/a.jpg" />)
    fail(img(c)); fail(img(c)); fail(img(c))
    expect(img(c)).toBe(null)
    c.rerender(<Hero src="https://eventbook.ro/b.webp" />)
    expect(img(c).getAttribute('src')).toBe('https://eventbook.ro/b.webp')
  })

  test('the picture is decorative — the words below it carry the event', () => {
    const c = render(<Hero src="https://a.ro/p.jpg" />)
    expect(img(c).getAttribute('alt')).toBe('')
    expect(img(c).getAttribute('aria-hidden')).toBe('true')
  })
})

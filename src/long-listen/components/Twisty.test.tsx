// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Twisty } from './Twisty'
import { forgetPlaces } from '../app/kept'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.location.hash = '#/p/w1' })
afterEach(cleanup)

const page = (onOpen?: () => void) => (
  <article data-page="programme:w1">
    <div id="work-a"><Twisty label="More context" value="x" onOpen={onOpen}><p>body</p></Twisty></div>
    <div id="work-b"><Twisty label="More context" value="x"><p>body</p></Twisty></div>
  </article>
)

describe('folds kept as they were left', () => {
  it('a fold opened by a tap opens again on the next visit, the same fold only', () => {
    const first = render(page())
    // A tap on the label, then the toggle the browser fires for it (happy-dom does neither on its own).
    const d = first.container.querySelector('details')!
    fireEvent.click(d.querySelector('summary')!)
    d.open = true
    d.dispatchEvent(new Event('toggle'))
    first.unmount()
    const again = render(page())
    const [a, b] = [...again.container.querySelectorAll('details')]
    expect(a.open).toBe(true)
    expect(b.open).toBe(false)
  })

  it('reopened from memory, it never acts as if tapped: no curator call by itself', () => {
    sessionStorage.setItem('long-listen:open-folds', JSON.stringify(['programme:w1|work-a|More context|0']))
    const onOpen = vi.fn()
    const r = render(page(onOpen))
    expect(r.container.querySelector('details')!.open).toBe(true)
    // The toggle the reopening dispatches is not a tap.
    r.container.querySelector('details')!.dispatchEvent(new Event('toggle'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('a fold the page opens itself (read once, the first time) is not kept as opened', () => {
    const r = render(<article data-page="programme:w1"><Twisty label="Why" readOnce="why:1"><p>x</p></Twisty></article>)
    r.container.querySelector('details')!.dispatchEvent(new Event('toggle'))
    expect(sessionStorage.getItem('long-listen:open-folds') ?? '[]').toBe('[]')
  })

  it('a journey replaced forgets the places and the drafts of the old one, and nothing else', () => {
    sessionStorage.setItem('long-listen:open-folds', '["x"]')
    sessionStorage.setItem('long-listen:trail', '[]')
    localStorage.setItem('long-listen:kept:notebook-notes', '"draft"')
    localStorage.setItem('long-listen:settings', '{}')
    forgetPlaces()
    expect(sessionStorage.getItem('long-listen:open-folds')).toBeNull()
    expect(sessionStorage.getItem('long-listen:trail')).toBeNull()
    expect(localStorage.getItem('long-listen:kept:notebook-notes')).toBeNull()
    expect(localStorage.getItem('long-listen:settings')).toBe('{}')
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProvocationBanner } from './ProvocationBanner'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'

afterEach(cleanup)

function thing(id: string, body: string): Thing {
  return {
    id,
    handle: body.slice(0, 20),
    body,
    kind: 'Passage',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-01-01',
    kept: '2026-01-02',
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  }
}

const a = thing('a', 'We are what we repeatedly do.')
const b = thing('b', 'A dog waited at the tram stop for someone who never came.')
const locus: Locus = { id: 'l1', name: 'Small attentions', meaning: 'Moments of noticing', coined: '2026-01-01' }

const noop = { onDismiss: vi.fn(), onAcceptPair: vi.fn(), onAcceptClearingForming: vi.fn() }

describe('ProvocationBanner', () => {
  // The heart of SILVA.md's provocation rule: "It never summarises, never
  // explains the connection, never writes the insight. Two objects on a
  // table." This test is the guard on that — if a future change starts
  // narrating *why* two things are together, it fails here.
  it('places two things beside each other and says nothing about the connection', () => {
    render(<ProvocationBanner provocation={{ kind: 'blind-pairing', a, b }} {...noop} />)
    expect(screen.getByText(/We are what we repeatedly do/)).toBeTruthy()
    expect(screen.getByText(/A dog waited at the tram stop/)).toBeTruthy()

    const copy = screen.getByRole('complementary').textContent || ''
    expect(copy).not.toMatch(/because|both|similar|relate[sd]?|in common|suggests|theme/i)
  })

  it('offers no "I see it too" for the one-thing kinds — there is nothing to connect', () => {
    render(<ProvocationBanner provocation={{ kind: 'shuffle', thing: a }} {...noop} />)
    expect(screen.queryByRole('button', { name: /i see it too/i })).toBeNull()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy()
  })

  it('names a clearing and lists what is in it', () => {
    render(<ProvocationBanner provocation={{ kind: 'random-clearing', locus, things: [a, b] }} {...noop} />)
    expect(screen.getByText('Small attentions')).toBeTruthy()
    expect(screen.getByText('Moments of noticing')).toBeTruthy()
  })

  // "A mycorrhizal link becomes real only through a human act… only you can
  // assert meaning" — so the Why is mandatory, and the accept button stays
  // disabled until the human has actually written one.
  it('will not walk a path until the human has written the why', async () => {
    const user = userEvent.setup()
    const onAcceptPair = vi.fn()
    render(
      <ProvocationBanner
        provocation={{ kind: 'near-neighbours', a, b, similarity: 0.8 }}
        {...noop}
        onAcceptPair={onAcceptPair}
      />,
    )

    await user.click(screen.getByRole('button', { name: /i see it too/i }))
    const walk = screen.getByRole('button', { name: /walk this path/i })
    expect(walk.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByLabelText(/what did you see between them/i), 'Both are about waiting.')
    await user.click(screen.getByRole('button', { name: /walk this path/i }))
    expect(onAcceptPair).toHaveBeenCalledWith(a, b, 'Both are about waiting.')
  })

  it('trims the why rather than saving trailing whitespace as the record', async () => {
    const user = userEvent.setup()
    const onAcceptPair = vi.fn()
    render(
      <ProvocationBanner provocation={{ kind: 'tension', a, b }} {...noop} onAcceptPair={onAcceptPair} />,
    )
    await user.click(screen.getByRole('button', { name: /i see it too/i }))
    await user.type(screen.getByLabelText(/what did you see between them/i), '  they disagree  ')
    await user.click(screen.getByRole('button', { name: /walk this path/i }))
    expect(onAcceptPair).toHaveBeenCalledWith(a, b, 'they disagree')
  })

  it('coins a clearing from a forming cluster, once it has a name', async () => {
    const user = userEvent.setup()
    const onAcceptClearingForming = vi.fn()
    render(
      <ProvocationBanner
        provocation={{ kind: 'clearing-forming', things: [a, b] }}
        {...noop}
        onAcceptClearingForming={onAcceptClearingForming}
      />,
    )
    await user.click(screen.getByRole('button', { name: /coin a clearing from these/i }))
    expect(screen.getByRole('button', { name: /coin this clearing/i }).hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByLabelText(/what do you call this clearing/i), 'Waiting')
    await user.click(screen.getByRole('button', { name: /coin this clearing/i }))
    expect(onAcceptClearingForming).toHaveBeenCalledWith([a, b], 'Waiting')
  })

  it('dismisses without connecting anything', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const onAcceptPair = vi.fn()
    render(
      <ProvocationBanner provocation={{ kind: 'blind-pairing', a, b }} {...noop} onDismiss={onDismiss} onAcceptPair={onAcceptPair} />,
    )
    await user.click(screen.getByRole('button', { name: /not really/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onAcceptPair).not.toHaveBeenCalled()
  })
})

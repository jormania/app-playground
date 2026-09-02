// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Programme from './Programme.jsx';
import { toProductions, byDate } from './programme.js';

afterEach(cleanup);

const event = (over = {}) => ({
  key: 'k',
  venue: 'Teatrul Excelsior',
  title: 'Tomcat',
  date: '2026-09-23',
  time: '20:00',
  ticketState: 'none',
  hall: null,
  link: null,
  image: null,
  price: null,
  ...over,
});

const scan = { scannedAt: '2026-08-26T09:00:00.000Z', hadSnapshot: true, changes: [], venues: [] };

const baseProps = {
  scan,
  triage: {},
  onKeep: () => {},
  onIgnore: () => {},
};

// The category/venue/hall filter tiers moved up into App.jsx entirely
// (§9.50) — they used to render inside Programme, and this file tested them
// here. Programme no longer receives or renders any of the three; App.test.jsx
// covers the tiered filtering behaviour now, against the real stacked block.

describe('Programme — the poster slot renders for every card, cover or not', () => {
  it('shows the real cover when a reader returned one', () => {
    const days = byDate(toProductions([event({ image: 'https://example.com/poster.jpg' })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(false)
    expect(poster.querySelector('img')?.src).toBe('https://example.com/poster.jpg')
  })

  it('falls back to the placeholder outline when there is no cover — never a blank gap', () => {
    const days = byDate(toProductions([event({ image: null })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(true)
    expect(poster.querySelector('img')).toBeNull()
    expect(poster.querySelector('svg')).toBeTruthy()
  })

  it('falls back to the placeholder when a real cover URL fails to load', () => {
    const days = byDate(toProductions([event({ image: 'https://example.com/broken.jpg' })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const img = container.querySelector('.prod__poster img')
    fireEvent.error(img)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(true)
    expect(poster.querySelector('img')).toBeNull()
  })
})

describe('Programme — swipe to Keep/Ignore (promoted from Loom’s ThreadRow)', () => {
  function drag(el, path) {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: path[0].x, clientY: path[0].y, pointerType: 'touch', button: 0 })
    for (const { x, y } of path.slice(1)) fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y })
  }

  it('fires onIgnore once a swipe left crosses the threshold', () => {
    const onIgnore = vi.fn()
    const days = byDate(toProductions([event()]))
    const { container } = render(
      <Programme {...baseProps} onIgnore={onIgnore} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />,
    )
    const body = container.querySelector('.prod__body')
    drag(body, [{ x: 200, y: 0 }, { x: 100, y: 0 }])
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 100, clientY: 0 })
    expect(onIgnore).toHaveBeenCalledTimes(1)
  })

  it('fires onKeep for the first showing once a swipe right crosses the threshold', () => {
    const onKeep = vi.fn()
    const days = byDate(toProductions([
      event({ key: 'a', date: '2026-09-23' }),
      event({ key: 'b', date: '2026-09-24' }),
    ]))
    const { container } = render(
      <Programme {...baseProps} onKeep={onKeep} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />,
    )
    const body = container.querySelector('.prod__body')
    drag(body, [{ x: 100, y: 0 }, { x: 200, y: 0 }])
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 200, clientY: 0 })
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onKeep.mock.calls[0][0].date).toBe('2026-09-23')
  })

  it('a swipe starting on a real control (the title link, a date button) fires neither', () => {
    const onIgnore = vi.fn()
    const onKeep = vi.fn()
    const days = byDate(toProductions([
      event({ key: 'a', date: '2026-09-23' }),
      event({ key: 'b', date: '2026-09-24' }),
    ]))
    render(
      <Programme {...baseProps} onIgnore={onIgnore} onKeep={onKeep} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />,
    )
    const dateButton = screen.getAllByRole('button', { name: /Sep/ })[0]
    drag(dateButton, [{ x: 200, y: 0 }, { x: 100, y: 0 }])
    fireEvent.pointerUp(dateButton, { pointerId: 1, clientX: 100, clientY: 0 })
    drag(dateButton, [{ x: 100, y: 0 }, { x: 200, y: 0 }])
    fireEvent.pointerUp(dateButton, { pointerId: 1, clientX: 200, clientY: 0 })
    expect(onIgnore).not.toHaveBeenCalled()
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('does not fire short of the swipe threshold, in either direction', () => {
    const onIgnore = vi.fn()
    const onKeep = vi.fn()
    const days = byDate(toProductions([event()]))
    const { container } = render(
      <Programme {...baseProps} onIgnore={onIgnore} onKeep={onKeep} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />,
    )
    const body = container.querySelector('.prod__body')
    drag(body, [{ x: 200, y: 0 }, { x: 160, y: 0 }])
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 160, clientY: 0 })
    drag(body, [{ x: 160, y: 0 }, { x: 190, y: 0 }])
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 190, clientY: 0 })
    expect(onIgnore).not.toHaveBeenCalled()
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('does nothing in either direction when swipeEnabled is false, buttons still work', () => {
    const onIgnore = vi.fn()
    const onKeep = vi.fn()
    const days = byDate(toProductions([event()]))
    const { container } = render(
      <Programme
        {...baseProps}
        onIgnore={onIgnore}
        onKeep={onKeep}
        days={days}
        venues={[{ name: 'Teatrul Excelsior', category: 'play' }]}
        swipeEnabled={false}
      />,
    )
    const body = container.querySelector('.prod__body')
    drag(body, [{ x: 200, y: 0 }, { x: 100, y: 0 }])
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 100, clientY: 0 })
    expect(onIgnore).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    expect(onIgnore).toHaveBeenCalledTimes(1)
  })
})

describe('Programme — the viewMode prop switches layouts', () => {
  // The List/Posters SWITCH itself lives in App.jsx's topbar now (three icon
  // buttons, freeing the vertical space this row used to take) — Programme
  // only has to render whichever layout `viewMode` says, which is what these
  // pin down.
  it('defaults to the list', () => {
    const days = byDate(toProductions([event()]))
    const { container } = render(
      <Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />,
    )
    expect(container.querySelector('.prod')).toBeTruthy()
    expect(container.querySelector('.poster-grid')).toBeNull()
  })

  it('renders the poster grid instead when told to', () => {
    const days = byDate(toProductions([event()]))
    const { container } = render(
      <Programme
        {...baseProps}
        days={days}
        venues={[{ name: 'Teatrul Excelsior', category: 'play' }]}
        viewMode="posters"
      />,
    )
    expect(container.querySelector('.poster-grid')).toBeTruthy()
    expect(container.querySelector('.prod')).toBeNull()
  })
})

describe('Programme — the "no tickets listed" chip', () => {
  const venues = [{ name: 'Teatrul Excelsior', category: 'play' }]

  it('marks a production the venue lists no tickets for', () => {
    const days = byDate(toProductions([event({ ticketState: 'none' })]))
    render(<Programme {...baseProps} days={days} venues={venues} />)
    expect(screen.getByText('no tickets listed')).toBeTruthy()
  })

  it('says nothing of the sort once any date is on sale', () => {
    const days = byDate(toProductions([
      event({ key: 'a', ticketState: 'none', date: '2026-09-23' }),
      event({ key: 'b', ticketState: 'open', date: '2026-09-24' }),
    ]))
    render(<Programme {...baseProps} days={days} venues={venues} />)
    expect(screen.queryByText('no tickets listed')).toBeNull()
    expect(screen.getByText('tickets')).toBeTruthy()
  })

  it('never shows alongside sold out — those are different claims', () => {
    const days = byDate(toProductions([event({ ticketState: 'sold-out' })]))
    render(<Programme {...baseProps} days={days} venues={venues} />)
    expect(screen.getByText('sold out')).toBeTruthy()
    expect(screen.queryByText('no tickets listed')).toBeNull()
  })
})

// §9.63 — the sold-out card used to be a dead end: a disabled Keep and nothing
// to do about it.
describe('Programme — watching a sold-out production', () => {
  const soldOut = () => byDate(toProductions([event({ ticketState: 'sold-out' })]))
  const venues = [{ name: 'Teatrul Excelsior', category: 'play' }]

  it('offers Watch where a sold-out card used to offer a disabled Keep', () => {
    const onWatch = vi.fn()
    render(<Programme {...baseProps} days={soldOut()} venues={venues} onWatch={onWatch} />)
    const watch = screen.getByRole('button', { name: 'Watch' })
    fireEvent.click(watch)
    expect(onWatch).toHaveBeenCalledTimes(1)
    expect(onWatch.mock.calls[0][0].title).toBe('Tomcat')
  })

  it('shows a watched card as watching, and pressing again is the way off', () => {
    const onWatch = vi.fn()
    render(
      <Programme {...baseProps} days={soldOut()} venues={venues} onWatch={onWatch}
        watchlist={{ 'teatrul excelsior::tomcat': { title: 'Tomcat', venue: 'Teatrul Excelsior' } }} />,
    )
    const watching = screen.getByRole('button', { name: /Watching/ })
    expect(watching.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(watching)
    expect(onWatch).toHaveBeenCalledTimes(1)
  })

  it('lists what is watched but not on anywhere — the case a card cannot cover', () => {
    const onWatch = vi.fn()
    render(
      <Programme {...baseProps} days={[]} venues={venues} onWatch={onWatch}
        awaited={[{ id: 'teatrul excelsior::tomcat', title: 'Tomcat', venue: 'Teatrul Excelsior', missedDate: '2026-09-23' }]} />,
    )
    expect(screen.getByText(/Watching · nothing listed yet/)).toBeTruthy()
    expect(screen.getByText('Tomcat')).toBeTruthy()
    // …and the usual "nothing matches" line stands down, because the list above
    // is the answer.
    expect(screen.queryByText(/Nothing/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop watching' }))
    expect(onWatch).toHaveBeenCalledWith({ id: 'teatrul excelsior::tomcat' }, { forget: true })
  })
})

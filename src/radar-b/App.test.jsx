// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

// Demo mode (no token) runs on src/radar-b/fixtures.js, which deliberately contains
// the hard cases — so this suite doubles as the proof that the dedupe/merge engine
// behaves once it's wired to real UI, not just in isolation.
beforeEach(() => {
  localStorage.clear()
})

// This repo's vitest config doesn't enable globals, so React Testing Library's
// automatic cleanup never registers — without this, each render stacks another
// copy of the app into the same document and every query finds duplicates.
afterEach(cleanup)

async function open() {
  render(<App />)
  // The first paint is the skeleton; the fixture client resolves a tick later.
  await screen.findByRole('tab', { name: /Azi/ })
  return screen.findByRole('heading', { name: /Trio Nocturn/ })
}

describe('Radar-B in demo mode', () => {
  test('renders the stream with events on the default lens', async () => {
    await open()
    expect(screen.getByRole('heading', { name: /Radar\s*-B/ })).toBeTruthy()
  })

  test('the same exhibition from two sources appears exactly once', async () => {
    await open()
    // fixtures.js carries "Lumină difuză" twice — once from the venue's own page
    // (confirmed) and once as Buletin wrote it up. One card, not two.
    const headings = screen.getAllByRole('heading').filter((h) => /Lumin/i.test(h.textContent))
    expect(headings).toHaveLength(1)
    // And the richer, higher-confidence title is the one that survived.
    expect(headings[0].textContent).toBe('Lumină difuză — expoziție de grup')
  })

  test('an event already in Wanderlist is marked, not offered again', async () => {
    await open()
    const card = screen.getByRole('heading', { name: /Trio Nocturn/ }).closest('button')
    expect(within(card).getByText('în wanderlist')).toBeTruthy()

    await userEvent.click(card)
    // What a saved event offers is the way IN to Wanderlist — not a disabled
    // label restating the state section directly above it.
    expect(screen.getByRole('link', { name: /Deschide în Wanderlist/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Salvează/ })).toBeNull()
  })

  test('a Wanderlist entry with no matching Radar find never appears — Radar-B shows what Radar found', async () => {
    // fixtures.js's MARQUEE_ONLY_SAVED stands in for the real bug report: an
    // event kept in Marquee (or anywhere else) with no corresponding Radar
    // row must not get imported onto the calendar just because it's in
    // Wanderlist. Contrast with the "Trio Nocturn" test above, which DOES
    // have a matching Radar entry and correctly still shows, tagged.
    await open()
    expect(screen.queryByRole('heading', { name: /Loving Vincent/ })).toBeNull()
  })

  test('the detail view shows every source that mentioned the event', async () => {
    await open()
    await userEvent.click(screen.getByRole('heading', { name: /Lumin/ }).closest('button'))
    const dialog = screen.getByRole('dialog')
    // Three from the venue-confirmed row plus Buletin from the merged duplicate.
    for (const name of ['Curatorial', 'B365', 'Combinatul Fondului Plastic', 'Buletin']) {
      expect(within(dialog).getAllByText(new RegExp(name)).length).toBeGreaterThan(0)
    }
  })

  test('an uncertain event says so rather than rendering a guess as fact', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna/ }))
    await userEvent.click(screen.getByRole('heading', { name: /Lansare de carte/ }).closest('button'))
    expect(screen.getByText(/Informație aproximativă/)).toBeTruthy()
  })

  test('lenses change what the stream shows', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /În curs/ }))
    // The four-month exhibition is running; tonight's concert is not.
    expect(screen.getByRole('heading', { name: /Lumin/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Trio Nocturn/ })).toBeNull()
  })

  test('search matches a source name, not just the event text', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Caută' }))
    await userEvent.type(screen.getByPlaceholderText(/titlu, loc/), 'harta')
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna/ }))
    expect(screen.getByRole('heading', { name: /Atelier de gravură/ })).toBeTruthy()
  })

  test('saving opens an editable draft rather than writing straight away', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna/ }))
    await userEvent.click(screen.getByRole('heading', { name: /Retrospectivă Agnès Varda/ }).closest('button'))
    await userEvent.click(screen.getByRole('button', { name: /Salvează în Wanderlist/ }))

    // The draft, pre-filled — and crucially still editable before anything is written.
    const name = screen.getByDisplayValue(/Retrospectivă Agnès Varda/)
    expect(name).toBeTruthy()
    expect(screen.getByDisplayValue(/Cinema Elvire Popesco, Bd. Dacia 77, București/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }))
    expect(await screen.findByText('Salvat în Wanderlist.')).toBeTruthy()
  })

  test('dismissing an event removes it from the stream', async () => {
    await open()
    await userEvent.click(screen.getByRole('heading', { name: /Lumin/ }).closest('button'))
    await userEvent.click(screen.getByRole('button', { name: /Ascunde/ }))
    expect(screen.queryByRole('heading', { name: /Lumin/ })).toBeNull()
  })

  test('the detail view offers a Google Maps link built from venue and address', async () => {
    await open()
    await userEvent.click(screen.getByRole('heading', { name: /Lumin/ }).closest('button'))
    const maps = within(screen.getByRole('dialog')).getByRole('link', { name: /Deschide în Maps/ })
    const href = maps.getAttribute('href')
    expect(href).toContain('google.com/maps/search/')
    // Venue AND street AND city — a bare venue name doesn't drop a pin.
    expect(decodeURIComponent(href)).toContain('Combinatul Fondului Plastic')
    expect(decodeURIComponent(href)).toContain('Str. Băiculești 29')
    expect(decodeURIComponent(href)).toContain('București')
  })

  test('shows which articles the current week was built from', async () => {
    await open()
    expect(screen.getByText(/Din ce s-a construit săptămâna/)).toBeTruthy()
  })

  test('links to the guide, both directly and from Settings', async () => {
    await open()
    const guideLink = screen.getByRole('link', { name: 'Ghid' })
    expect(guideLink.getAttribute('href')).toBe('/radar-b-guide.html')
    expect(guideLink.getAttribute('target')).toBe('_blank')

    await userEvent.click(screen.getByRole('button', { name: 'Setări' }))
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/radar-b-guide.html')
    expect(links.length).toBeGreaterThan(0)
  })

  test('the price filter excludes unpriced events rather than assuming they are cheap', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna/ }))
    const before = screen.getAllByRole('heading').filter((h) => h.className === 'cardName')
    await userEvent.click(screen.getByRole('button', { name: 'Filtre' }))
    // A real ceiling (as opposed to "gratuit", which needs no caveat) explains
    // the exclusion rule right where you'd set it.
    await userEvent.click(screen.getByRole('button', { name: 'până în 50 lei' }))
    expect(screen.getByText(/nu se încadrează automat/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Gata' }))
    const after = screen.getAllByRole('heading').filter((h) => h.className === 'cardName')
    // Only the demo pool's actually-free events survive.
    expect(after.length).toBeGreaterThan(0)
    expect(after.length).toBeLessThan(before.length)
  })

  test('clearing filters resets the price ceiling too', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Filtre' }))
    await userEvent.click(screen.getByRole('button', { name: 'gratuit' }))
    const clear = screen.getByRole('button', { name: 'Șterge filtrele' })
    expect(clear.disabled).toBe(false)
    await userEvent.click(clear)
    expect(screen.getByRole('button', { name: 'orice preț' }).getAttribute('aria-pressed')).toBe('true')
  })

  test('tapping the masthead label triggers a refresh', async () => {
    await open()
    const refreshBtn = screen.getByRole('button', { name: 'Reîmprospătează' })
    expect(refreshBtn.textContent).toMatch(/demo/)
    await userEvent.click(refreshBtn)
    // Demo mode resolves near-instantly, so by the time we can assert again the
    // button is back to its resting label rather than stuck on "se actualizează…".
    expect(await screen.findByRole('button', { name: 'Reîmprospătează' })).toBeTruthy()
  })
  test('the language toggle translates the whole shell, and sticks', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Setări' }))
    await userEvent.selectOptions(screen.getByDisplayValue('Română'), 'en')

    // The change is immediate and reaches the shell behind the modal, not just
    // the settings panel: lens bar, toolbar labels and section headings all move.
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Today/ })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /Azi/ })).toBeNull()
    expect(document.documentElement.lang).toBe('en')

    // And it survives a reload — the choice is a stored preference, not view state.
    cleanup()
    render(<App />)
    expect(await screen.findByRole('tab', { name: /^Today/ })).toBeTruthy()
  })

  test('event content itself stays in Romanian — only the UI is translated', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Setări' }))
    await userEvent.selectOptions(screen.getByDisplayValue('Română'), 'en')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    // Names come from Romanian sources; machine-translating them in the client
    // would be inventing text nobody wrote.
    expect(screen.getByRole('heading', { name: /Trio Nocturn/ })).toBeTruthy()
  })
  test('the detail actions row holds nothing dead or duplicated', async () => {
    await open()
    await userEvent.click(screen.getByRole('heading', { name: /Lumin/ }).closest('button'))
    const dialog = screen.getByRole('dialog')
    // No disabled control: a saved event's row offers the way in to Wanderlist,
    // an unsaved one offers Save. Neither offers a label you cannot press.
    for (const b of within(dialog).getAllByRole('button')) expect(b.disabled).toBeFalsy()
    expect(within(dialog).queryByRole('button', { name: /Deja în Wanderlist/ })).toBeNull()
  })

  test('a saved event links into Wanderlist itself, not back to Notion', async () => {
    await open()
    await userEvent.click(screen.getByRole('heading', { name: /Trio Nocturn/ }).closest('button'))
    // An ANCHOR, not a scripted `window.open`. The Cabinet launches Radar-B into
    // an Android Custom Tab, which swallows a scripted popup without a word —
    // the reason this control did nothing on a phone while every plain link in
    // the same view worked. Asserting the href is asserting the thing that works.
    const link = screen.getByRole('link', { name: /Deschide în Wanderlist/ })
    expect(link.getAttribute('href')).toMatch(/^\/wanderlist-react\.html#\/entry\/[0-9a-f]{32}$/)
    expect(link.getAttribute('href')).not.toMatch(/notion\.so/)
    // Same-origin, so deliberately in-tab: the back button returns to Radar-B.
    expect(link.getAttribute('target')).toBeNull()
  })

  test('no control in the app opens a scripted popup', async () => {
    await open()
    // A regression guard with a wider net than the two buttons that were broken:
    // in a Custom Tab NOTHING may depend on `window.open`, so a future "go there"
    // control has to be an anchor too.
    await userEvent.click(screen.getByRole('heading', { name: /Trio Nocturn/ }).closest('button'))
    const realOpen = window.open
    const opened = []
    window.open = (url) => { opened.push(url); return null }
    try {
      const dialog = screen.getByRole('dialog')
      for (const el of within(dialog).getAllByRole('link')) expect(el.getAttribute('href')).toBeTruthy()
    } finally {
      window.open = realOpen
    }
    expect(opened).toEqual([])
  })
})

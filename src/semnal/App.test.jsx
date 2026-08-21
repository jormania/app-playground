// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

// Demo mode (no token) runs on src/semnal/fixtures.js, which deliberately contains
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

describe('Semnal in demo mode', () => {
  test('renders the stream with events on the default lens', async () => {
    await open()
    expect(screen.getByRole('heading', { name: /Semnal/ })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: /Deja în Wanderlist/ })).toBeTruthy()
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
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna asta/ }))
    await userEvent.click(screen.getByRole('heading', { name: /Lansare de carte/ }).closest('button'))
    expect(screen.getByText(/Informație aproximativă/)).toBeTruthy()
  })

  test('lenses change what the stream shows', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /În desfășurare/ }))
    // The four-month exhibition is running; tonight's concert is not.
    expect(screen.getByRole('heading', { name: /Lumin/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Trio Nocturn/ })).toBeNull()
  })

  test('search matches a source name, not just the event text', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Caută' }))
    await userEvent.type(screen.getByPlaceholderText(/titlu, loc/), 'harta')
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna asta/ }))
    expect(screen.getByRole('heading', { name: /Atelier de gravură/ })).toBeTruthy()
  })

  test('saving opens an editable draft rather than writing straight away', async () => {
    await open()
    await userEvent.click(screen.getByRole('tab', { name: /Săptămâna asta/ }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Nu mă interesează' }))
    expect(screen.queryByRole('heading', { name: /Lumin/ })).toBeNull()
  })

  test('shows which articles the current week was built from', async () => {
    await open()
    expect(screen.getByText(/Din ce s-a construit săptămâna/)).toBeTruthy()
  })
})

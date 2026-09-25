// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { songOf } from '../../engine/testing/songs'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { ProfileRepo } from '../profiles'
import { memoryStore } from '../store'
import { SongLibrary } from './library'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))
// No keyboard: the screen's keys are all she has.
vi.mock('../connect/keyboard', () => ({
  useKeyboard: () => ({ connected: false, access: 'granted', name: null, checking: false, snapshot: { access: 'granted', error: null, inputs: [] } }),
}))
// The phone's synth, observed rather than played.
const played: number[] = []
vi.mock('../../probe/synth', () => ({
  SimpleSynth: class {
    async noteOn(p: number) {
      played.push(p)
    }
    noteOff() {}
    allOff() {}
  },
}))

let wide = false
beforeEach(() => {
  played.length = 0
  wide = false
  window.matchMedia = ((q: string) => ({ matches: wide && q.includes('landscape'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
afterEach(cleanup)

const SHORT = songOf([[60, 0], [62, 500], [64, 1000]], 'Three notes')

async function setUp(route: string) {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const p = await profiles.create('Nora', '🐺')
  await profiles.setCurrent(p.id)
  await new SongLibrary(store).add(SHORT)
  const log = new EngagementLog(store)
  history.replaceState(null, '', route)
  return { store, profileId: p.id, log, go: () => render(<Shell store={store} />) }
}

describe('Songs, for everyday use', () => {
  it('lists the starter songs easiest first, each with its level', async () => {
    ;(await setUp('#/door/songs')).go()
    await screen.findByText('Twinkle, Twinkle, Little Star')
    const rows = [...document.querySelectorAll('[class*="songTitle"]')].map((e) => e.textContent)
    // The level-1 songs come first, Für Elise last.
    expect(rows.slice(0, 5)).toEqual(['Twinkle, Twinkle, Little Star', 'Ode to Joy', 'Au clair de la lune', 'Hot Cross Buns', 'Mary Had a Little Lamb'])
    expect(rows[9]).toBe('Für Elise (opening)')
    // Five starter songs, and the added three-note one, worked out from its notes.
    expect(screen.getAllByText('Easy').length).toBe(6)
    expect(screen.getAllByText('Harder').length).toBe(2)
  })

  it('shows her best stars and when she last played, song by song', async () => {
    const { profileId, log, go } = await setUp('#/door/songs')
    await log.add(profileId, { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'wait' })
    await log.add(profileId, { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 2, score: 0.8, hit: 10, total: 12, wrong: 1 })
    go()
    const stars = await screen.findByLabelText('Best: 2 of 3 stars')
    expect(stars.textContent).toBe('★★☆')
    expect(screen.getByText('played today')).toBeTruthy()
    // A song never played says nothing.
    expect(screen.getByRole('button', { name: /Twinkle/ }).textContent).not.toMatch(/played/)
  })

  it('renames and removes an added song, only after a second tap', async () => {
    const { store, profileId, go } = await setUp('#/door/songs')
    go()
    expect(screen.queryByRole('button', { name: 'More for Twinkle, Twinkle, Little Star' })).toBeNull() // starters can't be changed
    fireEvent.click(await screen.findByRole('button', { name: 'More for Three notes' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Nora’s tune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }))
    expect(await screen.findByText('Nora’s tune')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More for Nora’s tune' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove this song' }))
    expect(await new SongLibrary(store).get(SHORT.id, 'en')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sure? Remove it' }))
    await waitFor(() => expect(screen.queryByText('Nora’s tune')).toBeNull())
    expect(await new SongLibrary(store).get(SHORT.id, 'en')).toBeNull()
    const types = (await new EngagementLog(store).read(profileId)).map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(['song_renamed', 'song_removed']))
  })

  it('sounds the on-screen keys on the phone when no keyboard is connected', async () => {
    const { go } = await setUp('#/play/Three%20notes')
    go()
    await screen.findByRole('button', { name: /Start/ })
    const c = screen.getAllByRole('button', { name: 'C' })[0]
    await act(async () => {
      fireEvent.pointerDown(c, { pointerId: 1 })
      fireEvent.pointerUp(c, { pointerId: 1 })
    })
    expect(played.length).toBe(1)
  })

  it('draws three octaves in landscape, where a short song would get keys as wide as a hand', async () => {
    const portrait = await setUp('#/play/Three%20notes')
    portrait.go()
    await screen.findByRole('button', { name: /Start/ })
    const narrow = [...document.querySelectorAll('[aria-pressed]')].length
    cleanup()
    wide = true
    const landscape = await setUp('#/play/Three%20notes')
    landscape.go()
    await screen.findByRole('button', { name: /Start/ })
    const wideKeys = [...document.querySelectorAll('[aria-pressed]')].length
    expect(narrow).toBe(13) // C4 to C5
    expect(wideKeys).toBe(37) // C3 to C6, middle C in the first half
  })
})

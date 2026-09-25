// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MidiEvent } from '../../midi/types'
import { songOf } from '../../engine/testing/songs'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { DEFAULT_PROFILE_SETTINGS, ProfileRepo, type ProfileSettings } from '../profiles'
import { memoryStore, type KeyValueStore } from '../store'
import { SongLibrary } from './library'
import { PartsRepo } from './parts'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

// Stand-in for the Yamaha: the test plays into whatever the play screen is listening with.
let yamaha: ((e: MidiEvent) => void) | null = null
vi.mock('../connect/keyboard', () => ({
  useKeyboard: (onEvent?: (e: MidiEvent) => void) => {
    if (onEvent) yamaha = onEvent
    return { connected: true, access: 'granted', name: 'Digital Keyboard', checking: false, snapshot: { access: 'granted', error: null, inputs: [] } }
  },
}))
const midi = (type: 'noteon' | 'noteoff', note: number, channel = 1, velocity = 80): MidiEvent =>
  ({ type, note, channel, velocity, time: performance.now() }) as unknown as MidiEvent

beforeEach(() => {
  yamaha = null
})
afterEach(cleanup)

// Ode to Joy's two phrases (right hand), as the starter pack has them.
const ODE_1 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]
const ODE_2 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60]
/** Play these keys on the screen, each once the song is waiting for it (a repeated note is simply played again). */
async function playThrough(pitches: number[]) {
  for (const p of pitches) {
    await waitFor(() => expect(Number(target()?.getAttribute('data-pitch'))).toBe(p))
    act(() => tap(document.querySelector<HTMLElement>(`[data-pitch="${p}"]`)!))
  }
}

const THREE = songOf([[60, 0], [62, 500], [64, 1000]], 'Three notes')

async function setUp(settings: Partial<ProfileSettings>, route: string) {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const p = await profiles.create('Nora', '🐺')
  await profiles.setCurrent(p.id)
  await profiles.saveSettings(p.id, { ...DEFAULT_PROFILE_SETTINGS, ...settings })
  await new SongLibrary(store).add(THREE)
  history.replaceState(null, '', route)
  render(<Shell store={store} />)
  return { store, profileId: p.id }
}

const events = (store: KeyValueStore, id: string) => new EngagementLog(store).read(id)
/** The on-screen key the song wants next. */
const target = () => document.querySelector<HTMLElement>('[data-target]')
const tap = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 1 })
  fireEvent.pointerUp(el, { pointerId: 1 })
}

describe('Songs door', () => {
  it('lists the starter pack and the family’s own songs, and opens one', async () => {
    await setUp({}, '#/door/songs')
    expect(await screen.findByText('Twinkle, Twinkle, Little Star')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Three notes/ }))
    expect(await screen.findByRole('button', { name: /Start/ })).toBeTruthy()
    expect(location.hash).toBe('#/play/Three%20notes')
  })

  it('goes back to the list for a song that is not on this phone', async () => {
    await setUp({}, '#/play/import%3Agone')
    expect(await screen.findByText('Starter songs')).toBeTruthy()
  })
})

describe('Play screen', () => {
  it('shows finger numbers on a starter song’s notes, and none once the setting is off', async () => {
    await setUp({}, '#/play/starter%3Aode')
    await screen.findByRole('button', { name: /Listen/ })
    // Ode to Joy's right hand starts E E F G: fingers 3 3 4 5.
    const fingers = () => [...document.querySelectorAll('[data-finger]')].map((e) => e.textContent)
    expect(fingers().slice(0, 4)).toEqual(['3', '3', '4', '5'])
    cleanup()
    await setUp({ fingers: false }, '#/play/starter%3Aode')
    await screen.findByRole('button', { name: /Listen/ })
    expect(fingers()).toEqual([])
  })

  it('learns a song in parts: part 1, part 2, then the whole song, each straight after the last', async () => {
    const { store, profileId } = await setUp({ onWrong: 'keepGoing' }, '#/play/starter%3Aode')
    // Ode to Joy is two phrases: 1, 2, then all of it. The first not learnt is chosen.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Part 1' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Part 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Whole song' })).toBeTruthy()
    expect(screen.getByText('Bars 1–4. A part waits for each note.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '▶ Part 1' }))
    tap(target()!) // middle C
    // A part waits for each note, whatever her own setting ("Keep going" here).
    await playThrough(ODE_1)
    expect(await screen.findByText('✓ Part 1 learnt!')).toBeTruthy()

    // Straight on: no middle C this time.
    fireEvent.click(screen.getByRole('button', { name: '▶ Part 2' }))
    await playThrough(ODE_2)
    expect(await screen.findByText('✓ Part 2 learnt!')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '▶ Whole song' }))
    // The whole song is played her own way: "Keep going" runs on a clock, with a count-in.
    await waitFor(() => expect(document.querySelector('[class*="countIn"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    await screen.findByRole('button', { name: 'Whole song' })

    const learnt = await new PartsRepo(store).get(profileId, 'starter:ode', 'right')
    expect([...learnt].sort()).toEqual(['p1', 'p2'])
    const parts = (await events(store, profileId)).filter((e) => e.type === 'song_part')
    expect(parts.map((e) => (e.type === 'song_part' ? [e.part, e.passed] : null))).toEqual([
      ['p1', true],
      ['p2', true],
    ])
    // Back in the setup, the whole song is the one still to learn.
    expect(screen.getByRole('button', { name: 'Whole song' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a part with too many wrong keys isn’t learnt, and offers another go', async () => {
    const { store, profileId } = await setUp({}, '#/play/starter%3Aode')
    fireEvent.click(await screen.findByRole('button', { name: '▶ Part 1' }))
    tap(target()!)
    // Ode to Joy starts on E.
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('E'))
    for (const k of ['A', 'B', 'A']) act(() => tap(screen.getAllByRole('button', { name: k })[0]))
    await playThrough(ODE_1)
    expect(await screen.findByText('3 keys went astray. Once more?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '▶ Part 2' })).toBeNull()
    expect(await new PartsRepo(store).get(profileId, 'starter:ode', 'right')).toEqual(new Set())
  })

  it('an added song has no fingering, so no numbers', async () => {
    await setUp({}, '#/play/Three%20notes')
    await screen.findByRole('button', { name: /Start/ })
    expect(document.querySelector('[data-finger]')).toBeNull()
  })

  it('plays a song through on the screen keys in “Wait for it”, then shows the report and logs it', async () => {
    const { store, profileId } = await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    expect(screen.getByText('Press middle C to begin')).toBeTruthy()

    // Any other key is explained, not started.
    tap(screen.getByRole('button', { name: 'D' }))
    expect(await screen.findByText('That was D. Middle C is the marked key.')).toBeTruthy()

    tap(target()!)
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    expect(await screen.findByText('How it went')).toBeTruthy()
    expect(screen.getByText('You played it to the end!')).toBeTruthy()
    expect(screen.getByLabelText('3 / 3')).toBeTruthy()
    // Next up: the easiest song she hasn't finished.
    expect(await screen.findByRole('button', { name: '▶ Twinkle, Twinkle, Little Star' })).toBeTruthy()

    const log = await events(store, profileId)
    expect(log.find((e) => e.type === 'song_started')).toMatchObject({ songId: 'Three notes', practice: 'right', tempo: 1, mode: 'wait' })
    expect(log.find((e) => e.type === 'song_finished')).toMatchObject({ songId: 'Three notes', stars: 3, hit: 3, total: 3, wrong: 0 })
  })

  it('practises a bar from the report until it’s clean, then goes back to the report', async () => {
    const { store, profileId } = await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    tap(target()!)
    // A wrong key on the way: bar 1 is worth another go.
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => tap(screen.getByRole('button', { name: 'G' })))
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    expect(await screen.findByText('Bar 1 is worth another go.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '🔁 Practise bar 1' }))
    // No middle C again: the octave is already known. In "Wait for it" one clean pass does it.
    expect(await screen.findByText('Play it clean: every note, no wrong key.')).toBeTruthy()
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    expect(await screen.findByText('🎉 Bar 1 is clean!')).toBeTruthy()
    await waitFor(async () => expect((await events(store, profileId)).at(-1)).toMatchObject({ type: 'song_loop', bar: 1, passes: 1, done: true, tempo: 1 }))

    fireEvent.click(screen.getByRole('button', { name: 'Back to how it went' }))
    expect(await screen.findByText('How it went')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '🔁 Practise bar 1' }))
    expect(await screen.findByText('Play it clean: every note, no wrong key.')).toBeTruthy()
    // Stopping part-way goes back to the report too, logged as not done.
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(await screen.findByText('How it went')).toBeTruthy()
    await waitFor(async () => expect((await events(store, profileId)).at(-1)).toMatchObject({ type: 'song_loop', passes: 0, done: false }))
  })

  it('a bar that isn’t clean goes round again', async () => {
    await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    tap(target()!)
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => tap(screen.getByRole('button', { name: 'G' })))
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    fireEvent.click(await screen.findByRole('button', { name: '🔁 Practise bar 1' }))
    await screen.findByText('Play it clean: every note, no wrong key.')
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => tap(screen.getByRole('button', { name: 'G' })))
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    expect(await screen.findByText('Once more.')).toBeTruthy()
    // After the break it starts again by itself.
    expect(await screen.findByText('Once more.', { selector: 'span' }, { timeout: 3000 })).toBeTruthy()
  })

  it('reads the Yamaha’s octave from the middle-C check, and ignores the accompaniment', async () => {
    await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    // Keyboard set an octave down (Function 014 = −1): middle C arrives as 48.
    act(() => yamaha!(midi('noteon', 48)))
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => {
      yamaha!(midi('noteon', 36, 10)) // a Style's kick drum
      yamaha!(midi('noteon', 48, 1, 3)) // a grazed key
      yamaha!(midi('noteon', 48))
      yamaha!(midi('noteon', 50))
      yamaha!(midi('noteon', 52))
    })
    expect(await screen.findByText('You played it to the end!')).toBeTruthy()
    expect(screen.getByText('3 of 3 notes right')).toBeTruthy()
  })

  it('logs a song stopped part-way as abandoned', async () => {
    const { store, profileId } = await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    tap(target()!)
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => tap(target()!))
    fireEvent.click(await screen.findByRole('button', { name: '■ Stop' }))
    expect(await screen.findByRole('button', { name: /Start/ })).toBeTruthy()
    await waitFor(async () => expect((await events(store, profileId)).at(-1)).toMatchObject({ type: 'song_abandoned', hit: 1, total: 3 }))
  })

  it('plays the song for her first with Listen, and logs it', async () => {
    const { store, profileId } = await setUp({}, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Listen/ }))
    expect(await screen.findByRole('button', { name: /■ Stop/ })).toBeTruthy()
    await waitFor(async () => expect((await events(store, profileId)).find((e) => e.type === 'song_listened')).toMatchObject({ songId: 'Three notes', practice: 'right', tempo: 1 }))
    fireEvent.click(screen.getByRole('button', { name: /■ Stop/ }))
    expect(await screen.findByRole('button', { name: /Listen/ })).toBeTruthy()
  })
})

describe('Play screen, after the audit', () => {
  it('logs leaving a song mid-way (the back arrow) as stopping it', async () => {
    const { store, profileId } = await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    tap(target()!)
    await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe('C'))
    act(() => tap(target()!))
    act(() => {
      history.pushState(null, '', '#/door/songs')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await screen.findByText('Starter songs')
    await waitFor(async () => expect((await events(store, profileId)).at(-1)).toMatchObject({ type: 'song_abandoned', songId: 'Three notes', hit: 1, total: 3 }))
  })

  it('draws the keys the chosen hands need, not the whole song', async () => {
    await setUp({}, '#/play/starter%3Aode')
    await screen.findByRole('button', { name: /Start/ })
    const keys = () => document.querySelectorAll('[aria-pressed]').length
    const right = keys()
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }))
    await waitFor(() => expect(keys()).toBeGreaterThan(right))
    expect(right).toBeLessThanOrEqual(25) // two octaves at most for the right hand of Ode to Joy
  })

  it('says which mode and timing are on, with the way to change them, and lets the middle-C wait go back', async () => {
    await setUp({ onWrong: 'wait', timing: 'relaxed' }, '#/play/Three%20notes')
    expect(await screen.findByText('On a wrong note: Wait for it · Timing: Relaxed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(screen.getByText('Press middle C to begin')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change speed' }))
    expect(screen.getByRole('button', { name: /Start/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(await screen.findByText('Settings for Nora')).toBeTruthy()
  })

  it('sends “Another song” to the song list, wherever the song was opened from', async () => {
    await setUp({ onWrong: 'wait' }, '#/play/Three%20notes')
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }))
    tap(target()!)
    for (const pitch of [60, 62, 64]) {
      await waitFor(() => expect(target()?.getAttribute('aria-label')).toBe({ 60: 'C', 62: 'D', 64: 'E' }[pitch]))
      act(() => tap(target()!))
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Another song' }))
    expect(await screen.findByText('Starter songs')).toBeTruthy()
    expect(location.hash).toBe('#/door/songs')
  })
})

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MidiEvent } from '../../midi/types'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { ProfileRepo } from '../profiles'
import { memoryStore } from '../store'
import { RecordRepo } from './records'
import { beatMs, ECHO_BPM, ECHO_PATTERNS } from './rhythm'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

// Stand-in for the Yamaha, as in the Songs tests.
let yamaha: ((e: MidiEvent) => void) | null = null
vi.mock('../connect/keyboard', () => ({
  keyboardConnection: () => ({ send: () => false }),
  useKeyboard: (onEvent?: (e: MidiEvent) => void) => {
    if (onEvent) yamaha = onEvent
    return { connected: true, access: 'granted', name: 'Digital Keyboard', checking: false, snapshot: { access: 'granted', error: null, inputs: [] } }
  },
}))
const key = (note: number) => act(() => yamaha!({ type: 'noteon', note, velocity: 80, channel: 1, time: performance.now() } as unknown as MidiEvent))
const off = (note: number) => act(() => yamaha!({ type: 'noteoff', note, velocity: 0, channel: 1, time: performance.now() } as unknown as MidiEvent))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function open(route: string) {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const p = await profiles.create('Nora', '🐺')
  await profiles.setCurrent(p.id)
  history.replaceState(null, '', route)
  render(<Shell store={store} />)
  return { store, profileId: p.id }
}
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))

describe('A first look', () => {
  it('shows a game’s card on entry until she says not to, and brings it back on asking', async () => {
    const { store, profileId } = await open('#/challenge/race')
    await flush()
    const card = () => screen.queryByRole('dialog', { name: 'Note race' })
    expect(card()).toBeTruthy()
    expect(screen.getByText(/Find as many as you can in 30 seconds/)).toBeTruthy()
    // "Let's go" closes it for now: the next visit shows it again.
    fireEvent.click(screen.getByRole('button', { name: 'Let’s go' }))
    expect(card()).toBeNull()
    cleanup()
    history.replaceState(null, '', '#/challenge/race')
    render(<Shell store={store} />)
    await flush()
    expect(card()).toBeTruthy()
    // Not again: kept for this player.
    fireEvent.click(screen.getByRole('button', { name: 'Don’t show this again' }))
    await flush()
    expect(await store.get<string[]>(`keypath:v1:intros:${profileId}`)).toEqual(['race'])
    cleanup()
    history.replaceState(null, '', '#/challenge/race')
    render(<Shell store={store} />)
    await flush()
    expect(card()).toBeNull()
    // Still there when asked for.
    fireEvent.click(screen.getByRole('button', { name: /How it works/ }))
    expect(card()).toBeTruthy()
    // Another game has its own.
    cleanup()
    history.replaceState(null, '', '#/challenge/ear')
    render(<Shell store={store} />)
    await flush()
    expect(screen.getByRole('dialog', { name: 'Ear check' })).toBeTruthy()
  })
})

describe('Challenges', () => {
  it('shows the five games with “no score yet”', async () => {
    await open('#/door/challenges')
    await flush()
    expect(screen.getByText('Note race')).toBeTruthy()
    expect(screen.getByText('Rhythm echo')).toBeTruthy()
    expect(screen.getByText('Chord catch')).toBeTruthy()
    expect(screen.getByText('Ear check')).toBeTruthy()
    expect(screen.getByText('Read and play')).toBeTruthy()
    expect(screen.getAllByText('No score yet')).toHaveLength(5)
  })

  it('note race on the staff: draws the note with no name, and keeps its own best', async () => {
    const { store, profileId } = await open('#/challenge/race')
    await flush()
    fireEvent.click(screen.getByRole('radio', { name: 'On the staff' }))
    expect(screen.getByText(/read it, then find it/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    const note = screen.getByRole('img', { name: 'A note on the staff' })
    expect(note.querySelectorAll('ellipse')).toHaveLength(1)
    expect(note.querySelector('text')).toBeNull() // no name, no time signature
    // Level 1 on the staff is C to G around middle C, so trying each of them finds it.
    for (const p of [60, 62, 64, 65, 67]) {
      key(p)
      if (screen.queryByText('1 found')) break
    }
    expect(screen.getByText('1 found')).toBeTruthy()
    advance(30_000)
    await flush()
    const bests = await new RecordRepo(store).get(profileId)
    expect(bests.staff[1]).toBe(1)
    expect(bests.race[1]).toBeUndefined()
    const log = await new EngagementLog(store).read(profileId)
    expect(log.find((e) => e.type === 'challenge_finished')).toMatchObject({ game: 'staff', level: 1, score: 1 })
  })

  it('chord catch: lights the chord, counts it played together, and waits for the hand to lift', async () => {
    const { store, profileId } = await open('#/challenge/chord')
    await flush()
    // G first: its keys from middle C would run off the screen keyboard, so it is lit an octave down.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    const SPELL: Record<string, number[]> = { C: [60, 64, 67], F: [65, 69, 72], G: [55, 59, 62] }
    const asked = () => document.querySelector('[class*="chordName"]')!.textContent!
    const first = asked()
    expect(first).toBe('G')
    // Level 1 lights the chord's keys on screen.
    const lit = [...document.querySelectorAll('[data-target]')].map((k) => k.getAttribute('aria-label'))
    expect(lit).toHaveLength(3)
    for (const p of SPELL[first]) key(p)
    expect(screen.getByText('1 caught')).toBeTruthy()
    expect(screen.getByText('Let go…')).toBeTruthy()
    for (const p of SPELL[first]) off(p)
    const second = asked()
    expect(second).not.toBe(first)
    // The right keys, but slowly: not a chord.
    key(SPELL[second][0])
    advance(400)
    key(SPELL[second][1])
    key(SPELL[second][2])
    expect(screen.getByText('All together!')).toBeTruthy()
    for (const p of SPELL[second]) off(p)
    advance(45_000)
    await flush()
    expect(screen.getByText('1 caught in 45 seconds!')).toBeTruthy()
    expect(screen.getByText('Right keys, not quite together: 1')).toBeTruthy()
    expect((await new RecordRepo(store).get(profileId)).chord[1]).toBe(1)
    random.mockRestore()
  })

  it('note race: counts the named keys found in 30 seconds and keeps the best', async () => {
    const { store, profileId } = await open('#/challenge/race')
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
    for (let i = 0; i < 5; i++) {
      const asked = NAMES.indexOf(screen.getByText(/^[A-G]♯?$/).textContent!)
      key(48 + asked) // any octave will do
    }
    key(61) // C♯ is never asked at level 1: a wrong key
    expect(screen.getByText('5 found')).toBeTruthy()
    advance(30_000)
    await flush()
    expect(screen.getByText('5 found in 30 seconds!')).toBeTruthy()
    expect(screen.getByText(/A new best!/)).toBeTruthy()
    expect(screen.getByText('Keys that weren’t it: 1')).toBeTruthy()
    expect((await new RecordRepo(store).get(profileId)).race[1]).toBe(5)
    const log = await new EngagementLog(store).read(profileId)
    expect(log.find((e) => e.type === 'challenge_finished')).toMatchObject({ game: 'race', level: 1, score: 5, best: true, wrong: 1 })
  })

  it('note race: a round with nothing found says so kindly, not “0 found!”', async () => {
    await open('#/challenge/race')
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    advance(30_000)
    await flush()
    expect(screen.getByText('None found this time. Have another go!')).toBeTruthy()
  })

  it('note race hides the names on the screen keys: finding them is the game', async () => {
    await open('#/challenge/race')
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    for (const k of screen.getAllByRole('button', { name: 'C' })) expect(k.textContent).toBe('')
  })

  it('rhythm echo: plays a bar, takes her taps after the count-in, and marks them', async () => {
    const { store, profileId } = await open('#/challenge/echo')
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await flush()
    const b = beatMs(ECHO_BPM[1])
    expect(screen.getByText('Listen…')).toBeTruthy()
    // Taps while KeyPath plays are the rhythm itself, not hers.
    advance(50 + 5 * b)
    key(60)
    advance(4 * b)
    expect(screen.getByText(/^Your turn in \d$/)).toBeTruthy()
    advance(3 * b)
    // Her bar: the first pattern of level 1 is four quarter notes; the third tap lands 100 ms late.
    const pattern = ECHO_PATTERNS[1][0]
    let at = 0
    for (const [i, beat] of pattern.entries()) {
      const target = beat * b + (i === 2 ? 100 : 0)
      advance(target - at)
      at = target
      key(60)
    }
    advance(5 * b)
    await flush()
    expect(screen.getByText('✓ That’s it!')).toBeTruthy()
    // Every note matched, the stray tap during "Listen" never counted, and the late one says so.
    const tapMarks = [...document.querySelectorAll('[data-verdict]')].filter((el) => el.className.includes('tapMark'))
    expect(tapMarks.map((el) => el.getAttribute('data-verdict'))).toEqual(['onTime', 'onTime', 'late', 'onTime'])
    expect(screen.queryByText(/Extra taps/)).toBeNull()

    // Walk the round to the end without playing, and the score is the one rhythm echoed.
    for (let i = 1; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next rhythm' }))
      await flush()
      advance(20 * b)
      await flush()
    }
    fireEvent.click(screen.getByRole('button', { name: 'See the score' }))
    await flush()
    expect(screen.getByText('1 of 5 rhythms echoed.')).toBeTruthy()
    expect((await new RecordRepo(store).get(profileId)).echo[1]).toBe(1)
  })
})

describe('Ear check', () => {
  it('plays two notes, hints which way after a wrong key, and keeps the notes found first time as its best', async () => {
    // With no randomness the questions are: find D, then E, D, E, D (the root is always middle C).
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const { store, profileId } = await open('#/challenge/ear')
      await flush()
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      expect(screen.getByText('Listen…')).toBeTruthy()
      // A key struck while the notes play is not an answer.
      key(62)
      advance(3000)
      expect(screen.getByText('Find the second note')).toBeTruthy()
      // F for D: too high, so "lower"; then D, found, but not first time.
      key(65)
      expect(screen.getByText('Try lower.')).toBeTruthy()
      key(62)
      expect(screen.getByText('Yes! That’s it.')).toBeTruthy()
      expect(screen.getByText('0 found first time')).toBeTruthy()
      advance(1200)
      expect(screen.getByText('2 of 5')).toBeTruthy()
      advance(3000)
      // The rest first time: E, D, E, D.
      for (const p of [64, 62, 64, 62]) {
        key(p)
        advance(1200)
        advance(3000)
      }
      await flush()
      expect(screen.getByText('4 of 5 found first time!')).toBeTruthy()
      expect((await new RecordRepo(store).get(profileId)).ear[1]).toBe(4)
      const log = await new EngagementLog(store).read(profileId)
      expect(log.find((e) => e.type === 'challenge_finished')).toMatchObject({ game: 'ear', level: 1, score: 4, wrong: 1 })
    } finally {
      vi.restoreAllMocks()
    }
  })
})

describe('Read and play', () => {
  it('writes a tune on the staff with the keys dark, lights one once she is stuck, and counts the tunes played clean', async () => {
    // With no randomness every tune is the same: C C D C C D C, in the C position.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const { store, profileId } = await open('#/challenge/read')
      await flush()
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      // Middle C first, to know the keyboard's octave.
      expect(screen.getByText('Press middle C to begin')).toBeTruthy()
      key(60)
      expect(screen.getByText('Tune 1 of 5')).toBeTruthy()
      expect(document.querySelector('svg[data-big]')).toBeTruthy()
      expect(screen.getByText('Right thumb on C')).toBeTruthy()
      expect(document.querySelector('[data-target]')).toBeNull()
      // A wrong key: written in red, and the key to play lights up.
      key(65)
      expect(document.querySelector('[data-wrong="65"]')).toBeTruthy()
      expect(document.querySelector('[data-target]')?.getAttribute('data-pitch')).toBe('60')
      const TUNE = [60, 60, 62, 60, 60, 62, 60]
      for (const p of TUNE) key(p)
      expect(screen.getByText('Played! A key or two went astray.')).toBeTruthy()
      // The next tune: no middle C again, and a pause on it lights the key by itself.
      advance(1300)
      expect(screen.getByText('Tune 2 of 5')).toBeTruthy()
      expect(document.querySelector('[data-target]')).toBeNull()
      advance(3000)
      expect(document.querySelector('[data-target]')?.getAttribute('data-pitch')).toBe('60')
      for (let n = 2; n <= 5; n++) {
        for (const p of TUNE) key(p)
        expect(screen.getByText('✓ Not one wrong key!')).toBeTruthy()
        advance(1300)
      }
      await flush()
      expect(screen.getByText('4 of 5 clean!')).toBeTruthy()
      expect((await new RecordRepo(store).get(profileId)).read[1]).toBe(4)
      const log = await new EngagementLog(store).read(profileId)
      expect(log.find((e) => e.type === 'challenge_finished')).toMatchObject({ game: 'read', level: 1, score: 4, wrong: 1 })
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('keeps a chord lit once she is stuck, even after one of its keys, and Stop leaves the round', async () => {
    // Both hands, no randomness: the first step is middle C over the C below.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const { store, profileId } = await open('#/challenge/read')
      await flush()
      fireEvent.click(screen.getByRole('radio', { name: 'Both hands' }))
      fireEvent.click(screen.getByRole('button', { name: /Start/ }))
      key(60)
      const lit = () => [...document.querySelectorAll('[data-target]')].map((k) => Number(k.getAttribute('data-pitch'))).sort((a, b) => a - b)
      expect(lit()).toEqual([])
      advance(3000)
      expect(lit()).toEqual([48, 60])
      key(60)
      expect(lit()).toContain(48)
      fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
      await flush()
      expect(screen.getByRole('radio', { name: 'Both hands' })).toBeTruthy()
      const log = await new EngagementLog(store).read(profileId)
      expect(log.at(-1)).toMatchObject({ type: 'challenge_left', game: 'read', level: 3 })
    } finally {
      vi.restoreAllMocks()
    }
  })
})

describe('The setup console, as on a song', () => {
  it('names its rows without visible headings, starts with one button, and goes away while the game runs', async () => {
    await open('#/challenge/race')
    await flush()
    const console = () => screen.queryByRole('region', { name: 'Set up the game' })
    expect(console()).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Show the note' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Level' })).toBeTruthy()
    expect(screen.queryByText('Level', { selector: 'span' })).toBeNull()
    // The best score and the hint run together under the button; "How it works" sits beside it.
    expect(screen.getByText('No score yet · The keys on screen have no names in this game: finding them is the game.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /How it works/ }).parentElement).toBe(screen.getByRole('button', { name: 'Start' }).parentElement)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(console()).toBeNull()
  })
})

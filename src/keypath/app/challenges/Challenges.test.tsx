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

describe('Challenges', () => {
  it('shows both games with “no score yet”', async () => {
    await open('#/door/challenges')
    await flush()
    expect(screen.getByText('Note race')).toBeTruthy()
    expect(screen.getByText('Rhythm echo')).toBeTruthy()
    expect(screen.getAllByText('No score yet')).toHaveLength(2)
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

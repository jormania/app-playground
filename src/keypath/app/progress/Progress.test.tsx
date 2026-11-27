// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecordRepo } from '../challenges/records'
import { JourneyRepo } from '../journey/progress'
import { Shell } from '../Shell'
import { K } from '../store'
import { ProfileRepo } from '../profiles'
import { memoryStore } from '../store'
import type { LogRecord } from '../log'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

afterEach(() => {
  cleanup()
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

/** The value beside a label: a headline tile, or a line in the Keyboard or Settings list. */
const valueOf = (label: string, within: ParentNode = document) =>
  [...within.querySelectorAll('dt')].find((dt) => dt.textContent === label)?.parentElement?.querySelector('dd')?.textContent
/** A song's figures, in the columns' order: tries, parts learnt, finished, stars. */
const songFigures = (title: string) => {
  const group = screen.getByRole('rowheader', { name: title }).closest('tbody')!
  return [...group.querySelectorAll('td')].map((td) => td.getAttribute('aria-label') ?? td.textContent)
}

async function setUp() {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const nora = await profiles.create('Nora', '🐺')
  await profiles.create('Gabriel', '🦉')
  await profiles.setCurrent(nora.id)
  // Long ago, so it can never be today: opening KeyPath starts today's session on top of it.
  const at = (h: number, m: number) => new Date(2025, 0, 6, h, m).toISOString()
  const records: LogRecord[] = [
    { type: 'session_start', at: at(18, 0), profileId: nora.id },
    { type: 'door_opened', door: 'songs', at: at(18, 1), profileId: nora.id },
    { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'wait', at: at(18, 2), profileId: nora.id },
    { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 15, total: 15, wrong: 0, at: at(18, 3), profileId: nora.id },
    { type: 'session_end', durationMs: 10 * 60000, at: at(18, 10), profileId: nora.id },
  ]
  await store.set(K.log(nora.id), records)
  await new JourneyRepo(store).pass(nora.id, 'middleC')
  await new RecordRepo(store).offer(nora.id, 'race', 1, 11)
  history.replaceState(null, '', '#/progress')
  render(<Shell store={store} />)
  return { store, nora }
}

describe('Progress', () => {
  it('reads a player’s log back: days, doors, songs by title, Journey steps', async () => {
    await setUp()
    // The seeded evening; the session opening Progress just started plays nothing, so it isn't a day played.
    await screen.findByText('At a glance')
    expect(valueOf('Days played')).toBe('1')
    // Two numbers in two tiles, not one line: "Sessions: 9, 37 min" read as 9.37 minutes.
    expect(valueOf('Sessions')).toBe('2')
    expect(valueOf('Time playing')).toBe('10 min')
    // Songs, opened once and first; about nine minutes there. A door never opened says so, not "0×".
    expect(screen.getByText('9 min')).toBeTruthy()
    expect(screen.getByText('opened once · the first door once')).toBeTruthy()
    expect(screen.getAllByText('Not opened yet')).toHaveLength(3)
    expect(songFigures('Ode to Joy')).toEqual(['1', '–', '1', '3 / 3'])
    expect(screen.getByText('1 of 10 steps')).toBeTruthy()
    // Games: the one played, with its best at its level; the rest named once, not as rows of zeros.
    expect(screen.getByRole('rowheader', { name: 'Note race' })).toBeTruthy()
    expect(screen.getByText('11 (C to G)')).toBeTruthy()
    expect(screen.getByText('Not played yet: Rhythm echo, Chord catch, Ear check, Read and play')).toBeTruthy()
    expect(screen.getByText('Not used yet.')).toBeTruthy()
  })

  it('switches to another player, who has nothing yet', async () => {
    await setUp()
    await screen.findByText('At a glance')
    fireEvent.click(screen.getByRole('radio', { name: /Gabriel/ }))
    expect(await screen.findByText('Nothing yet: the log fills as soon as Gabriel plays.')).toBeTruthy()
  })

  it('shares the same numbers as text, with the Journey steps and bests', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await setUp()
    fireEvent.click(await screen.findByRole('button', { name: 'Share progress…' }))
    await waitFor(() => expect(share).toHaveBeenCalled())
    const { title, text } = (share.mock.calls[0] as unknown as [{ title: string; text: string }])[0]
    expect(title).toBe('KeyPath progress: Nora')
    const json = JSON.parse(text.slice(text.indexOf('{')))
    expect(json).toMatchObject({ keypathProgress: 1, player: 'Nora', challengeBests: { race: { 1: 11 } }, keptTakes: 0 })
    expect(json.journeySteps.middleC.how).toBe('check')
    expect(json.summary.songs.bySong[0]).toMatchObject({ songId: 'starter:ode', title: 'Ode to Joy', bestStars: 3 })
  })

  it('writes the weekly note when asked, with the player’s name put in, and keeps it', async () => {
    localStorage.setItem('keypath:anthropicKey', JSON.stringify('sk-ant-test'))
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{name} finished Ode to Joy with three stars.' }], stop_reason: 'end_turn' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { store } = await setUp()
      fireEvent.click(await screen.findByRole('button', { name: 'Write this week’s note' }))
      expect(await screen.findByText('Nora finished Ode to Joy with three stars.')).toBeTruthy()
      // The name never left the phone.
      expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body).not.toContain('Nora')
      // Opening Progress again shows the kept note without asking.
      cleanup()
      history.replaceState(null, '', '#/progress')
      render(<Shell store={store} />)
      expect(await screen.findByText('Nora finished Ode to Joy with three stars.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Write it again' })).toBeTruthy()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
      localStorage.clear()
    }
  })

  it('says where a key goes when there is none', async () => {
    localStorage.clear()
    await setUp()
    expect(await screen.findByText(/With an Anthropic key in Settings → Claude/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Write this week’s note' })).toBeNull()
  })
})

describe('Progress: setting changes, in words', () => {
  it('names a setting and its values as Settings does, newest first, not as stored', async () => {
    const store = memoryStore()
    const profiles = new ProfileRepo(store)
    const nora = await profiles.create('Nora', '🐺')
    await profiles.setCurrent(nora.id)
    const at = (m: number) => new Date(2025, 0, 6, 18, m).toISOString()
    await store.set(K.log(nora.id), [
      { type: 'session_start', at: at(0), profileId: nora.id },
      { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'wait', at: at(1), profileId: nora.id },
      { type: 'setting_changed', key: 'onWrong', from: 'wait', to: 'show', at: at(2), profileId: nora.id },
      { type: 'setting_changed', key: 'keyNames', from: true, to: false, at: at(3), profileId: nora.id },
    ] as LogRecord[])
    history.replaceState(null, '', '#/progress')
    render(<Shell store={store} />)
    await screen.findByText('Changed')
    const changes = [...document.querySelectorAll('li')].map((li) => li.textContent).filter((x) => x?.includes('→'))
    expect(changes).toEqual(['6 JanNames on the keys: on → off', '6 JanOn a wrong note: Wait for it → Show it'])
  })
})

describe('Progress: a long song learnt in parts', () => {
  it('shows each song’s tries and parts learnt beside it, and where a keyboard setup was left', async () => {
    const store = memoryStore()
    const profiles = new ProfileRepo(store)
    const nora = await profiles.create('Nora', '🐺')
    await profiles.setCurrent(nora.id)
    const at = (m: number) => new Date(2025, 0, 6, 18, m).toISOString()
    const song = 'starter:saints'
    const records: LogRecord[] = [
      { type: 'session_start', at: at(0), profileId: nora.id },
      { type: 'keyboard_setup', outcome: 'left', step: 'allow', ms: 4000, at: at(1), profileId: nora.id },
      { type: 'keyboard_setup', outcome: 'left', step: 'allow', ms: 4000, at: at(2), profileId: nora.id },
      { type: 'keyboard_setup', outcome: 'done', step: 'play', ms: 20000, at: at(3), profileId: nora.id },
      ...[1, 2, 3].flatMap((n): LogRecord[] => [
        { type: 'song_started', songId: song, practice: 'right', tempo: 1, mode: 'wait', at: at(4 + n), profileId: nora.id },
        { type: 'song_part', songId: song, practice: 'right', part: `p${n}`, passed: true, wrong: 0, at: at(4 + n), profileId: nora.id },
      ]),
    ]
    await store.set(K.log(nora.id), records)
    history.replaceState(null, '', '#/progress')
    render(<Shell store={store} />)
    await screen.findByText('At a glance')
    expect(songFigures('When the Saints Go Marching In')).toEqual(['3', '3', '–', '–'])
    expect(valueOf('Setups finished')).toBe('1')
    expect(valueOf('Setups left before the end')).toBe('2')
    expect(valueOf('at “Allow access”')).toBe('2')
  })
})

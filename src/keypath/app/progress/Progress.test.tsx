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
    // The seeded evening, plus the session opening KeyPath just started.
    expect(await screen.findByText('Days played: 2')).toBeTruthy()
    expect(screen.getByText('Sessions: 2, 10 min in all')).toBeTruthy()
    // Songs, opened once and first; about nine minutes there.
    expect(screen.getByText('opened 1× · first 1× · ~9 min')).toBeTruthy()
    expect(screen.getByText('Ode to Joy')).toBeTruthy()
    expect(screen.getByText(/1 finished · 0 stopped · ★★★/)).toBeTruthy()
    expect(screen.getByText('1 of 10 steps done, 0 of them tested out')).toBeTruthy()
  })

  it('switches to another player, who has nothing yet', async () => {
    await setUp()
    await screen.findByText('Days played: 2')
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

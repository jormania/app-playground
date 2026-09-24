// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Emitter } from '../../midi/emitter'
import type { ConnectionSnapshot, MidiConnection, MidiEvent } from '../../midi/types'
import { setKeyboardConnection } from '../connect/keyboard'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { ProfileRepo } from '../profiles'
import { parseSmf } from '../../engine'
import { memoryStore, PREFIX } from '../store'
import { TakeRepo } from './takes'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

const YAMAHA = { id: 'y', name: 'Digital Keyboard', manufacturer: 'Yamaha Corporation', state: 'connected' as const, looksLikeYamaha: true }

/** A connected Yamaha with an output port: what the test plays arrives as input, what KeyPath sends lands in `sent`. */
class FakeYamaha implements MidiConnection {
  readonly kind = 'webmidi' as const
  sent: { data: number[]; at?: number }[] = []
  private state: ConnectionSnapshot = { access: 'granted', error: null, inputs: [YAMAHA], outputs: [YAMAHA] }
  private events = new Emitter<MidiEvent>()
  private changes = new Emitter<ConnectionSnapshot>()
  async open() {
    return this.state
  }
  close() {}
  snapshot() {
    return this.state
  }
  onEvent(l: (e: MidiEvent) => void) {
    return this.events.on(l)
  }
  onChange(l: (s: ConnectionSnapshot) => void) {
    return this.changes.on(l)
  }
  send(data: number[], at?: number) {
    this.sent.push({ data, at })
    return true
  }
  emit(e: Partial<MidiEvent> & { type: string }) {
    act(() => this.events.emit({ channel: 1, velocity: 80, time: performance.now(), ...e } as unknown as MidiEvent))
  }
}

let kb: FakeYamaha
beforeEach(() => {
  kb = new FakeYamaha()
  setKeyboardConnection(kb)
})
afterEach(() => {
  cleanup()
  setKeyboardConnection(null)
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

describe('Studio', () => {
  it('records what she plays over a Style (not the Style), keeps it, and plays it back on the keyboard', async () => {
    const { store, profileId } = await open('#/door/studio')
    expect(await screen.findByText(/KeyPath records what you play, not the Style/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Keyboard' }).getAttribute('aria-checked')).toBe('true')
    // findByText resolves on the first paint, which can land before useKeyboard's effect
    // subscribes to the keyboard. Flush it, or on a slow runner the Start below is lost.
    await act(async () => {})

    kb.emit({ type: 'realtime', status: 0xfa }) // she starts a Style
    fireEvent.click(screen.getByRole('button', { name: '● Record' }))
    kb.emit({ type: 'noteon', note: 60 })
    kb.emit({ type: 'noteon', note: 36, channel: 10 }) // the Style's kick drum
    kb.emit({ type: 'noteoff', note: 60 })
    kb.emit({ type: 'noteon', note: 64 })
    kb.emit({ type: 'noteoff', note: 64 })
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(await screen.findByText(/New take: 0:00, 2 notes/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(await screen.findByText('Take 1')).toBeTruthy()
    expect(screen.getByText(/with a Style/)).toBeTruthy()
    const [take] = await new TakeRepo(store).list(profileId)
    expect(take.notes.map((n) => n.pitch)).toEqual([60, 64])

    fireEvent.click(screen.getByRole('button', { name: '▶ Play Take 1' }))
    await waitFor(() => expect(kb.sent.some((m) => m.data[0] === 0x90 && m.data[1] === 60)).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop Take 1' }))
    expect(kb.sent.some((m) => m.data[0] === 0xb0 && m.data[1] === 123)).toBe(true)

    const types = (await new EngagementLog(store).read(profileId)).map((e) => e.type).filter((x) => x.startsWith('studio'))
    expect(types).toEqual(['studio_opened', 'studio_recorded', 'studio_kept', 'studio_played'])
  })

  it('says so when nothing was played, and keeps nothing', async () => {
    await open('#/door/studio')
    fireEvent.click(await screen.findByRole('button', { name: '● Record' }))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(await screen.findByText('Nothing was played in that take.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Keep it' })).toBeNull()
  })

  it('favourites a take, and deletes one only on a second tap', async () => {
    const { store, profileId } = await open('#/door/studio')
    await new TakeRepo(store).keep(profileId, { ms: 500, notes: [{ pitch: 60, velocity: 80, startMs: 0, durationMs: 200 }], pedal: [] }, { style: false })
    fireEvent.click(await screen.findByRole('button', { name: '● Record' }))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    await screen.findByText('Take 1')

    fireEvent.click(screen.getByRole('button', { name: 'Favourite' }))
    await waitFor(async () => expect((await new TakeRepo(store).list(profileId))[0].favourite).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'More for Take 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await new TakeRepo(store).list(profileId)).toHaveLength(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Sure?' }))
    await waitFor(async () => expect(await new TakeRepo(store).list(profileId)).toHaveLength(0))
    expect(await screen.findByText('Takes you keep appear here.')).toBeTruthy()
  })

  it('counts in four clicks, starts the take on the next beat, and remembers the tempo', async () => {
    const { store, profileId } = await open('#/door/studio')
    await screen.findByText(/KeyPath records what you play, not the Style/)
    await act(async () => {})
    fireEvent.click(screen.getByRole('radio', { name: '120' }))
    expect(screen.getByText(/Four clicks at 120 beats a minute/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '● Record' }))
    expect(screen.getByText('Recording in 4…')).toBeTruthy()
    kb.emit({ type: 'noteon', note: 50 }) // noodling during the count-in: not the take
    kb.emit({ type: 'noteoff', note: 50 })
    await act(() => new Promise((r) => setTimeout(r, 2200)))
    // The four clicks went to the keyboard, the first one louder.
    const clicks = kb.sent.filter((m) => m.data[0] === 0x90 && m.data[1] === 84)
    expect(clicks.map((m) => m.data[2])).toEqual([110, 70, 70, 70])
    expect(screen.getByRole('button', { name: '■ Stop' })).toBeTruthy()
    kb.emit({ type: 'noteon', note: 60 })
    kb.emit({ type: 'noteoff', note: 60 })
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it' }))
    await screen.findByText('Take 1')
    const [take] = await new TakeRepo(store).list(profileId)
    expect(take.notes.map((n) => n.pitch)).toEqual([60])
    expect(take.bpm).toBe(120)
    expect(await store.get(`${PREFIX}studioCountIn`)).toBe(120)
    expect((await new EngagementLog(store).read(profileId)).find((e) => e.type === 'studio_recorded')).toMatchObject({ countIn: 120 })
  })

  it('cancels a count-in, and records nothing', async () => {
    await open('#/door/studio')
    await screen.findByText(/KeyPath records what you play/)
    fireEvent.click(screen.getByRole('radio', { name: '60' }))
    fireEvent.click(screen.getByRole('button', { name: '● Record' }))
    fireEvent.click(screen.getByRole('button', { name: '✕ Cancel' }))
    expect(screen.queryByText(/Recording in/)).toBeNull()
    expect(screen.getByRole('button', { name: '● Record' })).toBeTruthy()
    await act(() => new Promise((r) => setTimeout(r, 300)))
    expect(screen.queryByText(/Recording ·/)).toBeNull()
  })

  it('renames a take and saves it as a MIDI file under its name', async () => {
    const { store, profileId } = await open('#/door/studio')
    await new TakeRepo(store).keep(profileId, { ms: 1500, notes: [{ pitch: 60, velocity: 80, startMs: 0, durationMs: 500 }], pedal: [] }, { style: false, bpm: 80 })
    fireEvent.click(await screen.findByRole('button', { name: '● Record' }))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    fireEvent.click(await screen.findByRole('button', { name: 'More for Take 1' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning song' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText('Morning song')).toBeTruthy()

    let blob: Blob | null = null
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:take'))
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'More for Morning song' }))
    expect(screen.getByText(/after a count-in at 80/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save as a MIDI file' }))
    expect(await screen.findByText('Saved as Morning-song.mid, in the phone’s Downloads.')).toBeTruthy()
    expect(click).toHaveBeenCalled()
    const file = parseSmf(new Uint8Array(await blob!.arrayBuffer()))
    expect(file.tracks[0].name).toBe('Morning song')
    expect(file.notes.map((n) => n.pitch)).toEqual([60])
    click.mockRestore()
    const types = (await new EngagementLog(store).read(profileId)).map((e) => e.type)
    expect(types).toContain('studio_renamed')
    expect((await new EngagementLog(store).read(profileId)).find((e) => e.type === 'studio_exported')).toMatchObject({ outcome: 'saved' })
  })

  it('opens as “Make it yours” from a song, with its tune as a reminder, and names the take after it', async () => {
    const { store, profileId } = await open('#/studio/starter%3Aode')
    expect(await screen.findByText('Make it yours: Ode to Joy')).toBeTruthy()
    expect(screen.getByLabelText('The tune').textContent).toMatch(/^E E F G {2}\| {2}G F E D/)
    fireEvent.click(screen.getByRole('button', { name: '● Record' }))
    kb.emit({ type: 'noteon', note: 64 })
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it' }))
    expect(await screen.findByText('Ode to Joy, take 1')).toBeTruthy()
    expect((await new EngagementLog(store).read(profileId)).find((e) => e.type === 'studio_opened')).toMatchObject({ from: 'song', songId: 'starter:ode' })
  })
})

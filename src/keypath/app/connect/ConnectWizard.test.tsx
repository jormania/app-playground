// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Emitter } from '../../midi/emitter'
import type { ConnectionSnapshot, MidiConnection, MidiEvent } from '../../midi/types'
import { Shell } from '../Shell'
import { EngagementLog } from '../log'
import { ProfileRepo } from '../profiles'
import { K, memoryStore, type KeyValueStore } from '../store'
import { setKeyboardConnection } from './keyboard'
import { rememberKeyboard } from './remember'

vi.mock('../../App', () => ({ default: () => <div>probe screen</div> }))

const YAMAHA = { id: 'native:port-in-0', name: 'Digital Keyboard', manufacturer: 'Yamaha Corporation', state: 'connected' as const, looksLikeYamaha: true }

/** A keyboard the test plugs in, unplugs and plays; `answer` is what the permission prompt returns. */
class FakeKeyboard implements MidiConnection {
  readonly kind = 'webmidi' as const
  answer: 'granted' | 'denied' = 'granted'
  plugged = false
  private state: ConnectionSnapshot = { access: 'idle', error: null, inputs: [] }
  private events = new Emitter<MidiEvent>()
  private changes = new Emitter<ConnectionSnapshot>()
  async open() {
    return this.set(this.answer === 'granted' ? { access: 'granted', error: null, inputs: this.plugged ? [YAMAHA] : [] } : { access: 'denied', error: 'NotAllowedError', inputs: [] })
  }
  close() {
    this.set({ access: 'idle', error: null, inputs: [] })
  }
  snapshot() {
    return this.state
  }
  onEvent(l: (e: MidiEvent) => void) {
    return this.events.on(l)
  }
  onChange(l: (s: ConnectionSnapshot) => void) {
    return this.changes.on(l)
  }
  plug(on = true) {
    this.plugged = on
    if (this.state.access === 'granted') this.set({ ...this.state, inputs: on ? [YAMAHA] : [] })
  }
  play(note: number, channel = 1) {
    this.events.emit({ type: 'noteon', note, velocity: 80, channel, time: 0, receivedAt: 0, source: 'webmidi', deviceId: YAMAHA.id })
  }
  private set(s: ConnectionSnapshot) {
    this.state = s
    this.changes.emit(s)
    return s
  }
}

let kb: FakeKeyboard
let permission: PermissionState
beforeEach(() => {
  kb = new FakeKeyboard()
  setKeyboardConnection(kb)
  permission = 'prompt'
  // Chrome: Web MIDI present, and the permission state readable without asking.
  Object.defineProperty(navigator, 'requestMIDIAccess', { value: () => Promise.reject(new Error('unused')), configurable: true })
  Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: permission }) }, configurable: true })
})
afterEach(() => {
  cleanup()
  setKeyboardConnection(null)
  vi.useRealTimers()
})

async function open(route = '#/connect', prepare?: (store: KeyValueStore) => Promise<void>) {
  const store = memoryStore()
  const profiles = new ProfileRepo(store)
  const p = await profiles.create('Nora', '🐺')
  await profiles.setCurrent(p.id)
  await prepare?.(store)
  history.replaceState(null, '', route)
  render(<Shell store={store} />)
  return { store, profileId: p.id }
}

const current = () => document.querySelector('[aria-current="step"]')?.querySelector('h2')?.textContent

describe('Connect the keyboard', () => {
  it('walks a new phone through every step, checking each, and only calls it done when a key arrives', async () => {
    const { store, profileId } = await open()
    await waitFor(() => expect(current()).toBe('Plug in'))
    expect(screen.getByText('Chrome can talk to the keyboard.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(current()).toBe('Allow access')
    fireEvent.click(screen.getByRole('button', { name: 'Ask me' }))
    await waitFor(() => expect(current()).toBe('Find the keyboard'))
    expect(screen.getByText('Looking for it…')).toBeTruthy()

    act(() => kb.plug())
    await waitFor(() => expect(current()).toBe('Press any key'))
    expect(screen.getByText('Found: Digital Keyboard')).toBeTruthy()

    // A Style's drums prove nothing about the keys.
    act(() => kb.play(36, 10))
    expect(current()).toBe('Press any key')
    act(() => kb.play(64))
    expect(await screen.findByText('✓ Ready to play')).toBeTruthy()
    expect(screen.getByText('Last key: E')).toBeTruthy()

    await waitFor(async () => expect(await store.get(K.keyboard)).toMatchObject({ name: 'Digital Keyboard' }))
    const log = await new EngagementLog(store).read(profileId)
    expect(log.find((e) => e.type === 'keyboard_setup')).toMatchObject({ outcome: 'done' })
  })

  it('shows what to check when the keyboard doesn’t appear, and moves on by itself when it does', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await open()
    await waitFor(() => expect(current()).toBe('Plug in'))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask me' }))
    await waitFor(() => expect(current()).toBe('Find the keyboard'))
    expect(screen.queryByText('Not showing up yet. Check:')).toBeNull()
    act(() => void vi.advanceTimersByTime(6000))
    expect(screen.getByText('Not showing up yet. Check:')).toBeTruthy()
    expect(screen.getByText('Storage Mode is off (FUNCTION 058).')).toBeTruthy()
    act(() => kb.plug())
    await waitFor(() => expect(current()).toBe('Press any key'))
  })

  it('explains a blocked permission and offers to try again', async () => {
    kb.answer = 'denied'
    await open()
    await waitFor(() => expect(current()).toBe('Plug in'))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask me' }))
    expect(await screen.findByText(/Access is blocked/)).toBeTruthy()
    kb.answer = 'granted'
    kb.plugged = true
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(current()).toBe('Press any key'))
  })

  it('goes straight to the key press when the keyboard is already plugged in and allowed', async () => {
    permission = 'granted'
    kb.plugged = true
    await open()
    await waitFor(() => expect(current()).toBe('Press any key'))
    expect(screen.queryByRole('button', { name: 'Ask me' })).toBeNull()
  })

  it('says to use Chrome where there is no Web MIDI', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined, configurable: true })
    await open()
    expect(await screen.findByText('This browser can’t talk to a keyboard. Open KeyPath in Chrome.')).toBeTruthy()
  })

  it('logs the step someone gave up on', async () => {
    const { store, profileId } = await open()
    await waitFor(() => expect(current()).toBe('Plug in'))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    cleanup()
    await waitFor(async () => expect((await new EngagementLog(store).read(profileId)).at(-1)).toMatchObject({ type: 'keyboard_setup', outcome: 'left', step: 'allow' }))
  })
})

describe('Keyboard status on Home', () => {
  it('shows a Connect card on a phone that has never reached a keyboard', async () => {
    await open('#/home')
    fireEvent.click(await screen.findByRole('button', { name: /Connect your keyboard/ }))
    await waitFor(() => expect(location.hash).toBe('#/connect'))
  })

  it('after that, a status line with Connect while unplugged, and Keyboard ready when plugged', async () => {
    permission = 'granted'
    await open('#/home', (store) => rememberKeyboard(store, 'Digital Keyboard'))
    expect(await screen.findByText('Keyboard not connected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
    act(() => kb.plug())
    expect(await screen.findByText('Keyboard ready')).toBeTruthy()
  })
})

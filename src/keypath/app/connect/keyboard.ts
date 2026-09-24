import { useEffect, useState } from 'react'
import { WebMidiConnection } from '../../midi/webMidiConnection'
import type { ConnectionSnapshot, MidiConnection, MidiEvent } from '../../midi/types'

// One MIDI connection for the whole tutor, opened once and kept for the life of
// the page, so Home, the play screen and the connection wizard all see the same
// keyboard. (Diagnostics keeps its own, separate connection, so the probe stays
// exactly as it was.)
let connection: MidiConnection | null = null
let opening: Promise<ConnectionSnapshot> | null = null

export function keyboardConnection(): MidiConnection {
  connection ??= new WebMidiConnection()
  return connection
}

/** Tests swap in a SimulatedConnection or a fake; null goes back to Web MIDI. */
export function setKeyboardConnection(c: MidiConnection | null): void {
  connection?.close()
  connection = c
  opening = null
}

export type MidiPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

/** What Chrome would do if asked, without asking. */
export async function midiPermission(): Promise<MidiPermission> {
  try {
    const s = await navigator.permissions.query({ name: 'midi' as PermissionName })
    return s.state
  } catch {
    return 'unknown'
  }
}

/** Ask for the keyboard. May show Chrome's permission prompt, so call it from a tap. */
export function connectKeyboard(): Promise<ConnectionSnapshot> {
  const c = keyboardConnection()
  if (c.snapshot().access === 'granted') return Promise.resolve(c.snapshot())
  opening ??= c.open().finally(() => (opening = null))
  return opening
}

export interface KeyboardStatus {
  /** A keyboard is plugged in and its port is open. */
  connected: boolean
  access: ConnectionSnapshot['access']
  /** The connected keyboard's name, preferring the Yamaha if several are attached. */
  name: string | null
  /** Still finding out whether access was already granted; don't show a verdict yet. */
  checking: boolean
  snapshot: ConnectionSnapshot
}

export function statusOf(s: ConnectionSnapshot, checking = false): KeyboardStatus {
  const live = s.access === 'granted' ? s.inputs.filter((i) => i.state === 'connected') : []
  const best = live.find((i) => i.looksLikeYamaha) ?? live[0]
  return { connected: !!best, access: s.access, name: best ? best.name || best.manufacturer || '?' : null, checking, snapshot: s }
}

/**
 * The keyboard's live status, and its events while mounted (straight to
 * `onEvent`, never through React state).
 *
 * Opens the connection by itself only when Chrome already allows it, so no
 * screen ever raises the permission prompt unannounced: asking is the
 * connection wizard's job, where it's explained first.
 */
export function useKeyboard(onEvent?: (e: MidiEvent) => void): KeyboardStatus {
  const [status, setStatus] = useState<KeyboardStatus>(() => statusOf(keyboardConnection().snapshot(), true))
  useEffect(() => {
    const c = keyboardConnection()
    const offEvent = onEvent ? c.onEvent(onEvent) : () => {}
    const offChange = c.onChange((s) => setStatus(statusOf(s)))
    let live = true
    if (c.snapshot().access === 'idle') {
      void midiPermission()
        .then(async (p) => {
          if (p !== 'granted') return
          const s = await connectKeyboard()
          // Allowed, yet refused without a tap: back to idle, and the wizard's button will ask.
          if (s.access === 'denied') c.close()
        })
        .finally(() => live && setStatus(statusOf(c.snapshot())))
    } else setStatus(statusOf(c.snapshot()))
    return () => {
      live = false
      offEvent()
      offChange()
    }
  }, [onEvent])
  return status
}

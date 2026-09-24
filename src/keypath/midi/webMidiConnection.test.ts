import { describe, expect, it, vi } from 'vitest'
import { WebMidiConnection } from './webMidiConnection'
import type { MidiEvent } from './types'

function fakeInput(id: string, name: string, manufacturer: string) {
  return { id, name, manufacturer, state: 'connected', onmidimessage: null as null | ((e: unknown) => void) }
}

function fakeNavigator(inputs: ReturnType<typeof fakeInput>[], reject?: Error) {
  const access = {
    inputs: new Map(inputs.map((i) => [i.id, i])),
    onstatechange: null as null | (() => void),
  }
  const nav = { requestMIDIAccess: vi.fn(() => (reject ? Promise.reject(reject) : Promise.resolve(access))) }
  return { nav: nav as unknown as Navigator, access }
}

describe('WebMidiConnection', () => {
  it('reports insecure contexts before trying anything', async () => {
    const c = new WebMidiConnection({ navigator: {} as Navigator, isSecureContext: false, now: () => 0 })
    expect((await c.open()).access).toBe('insecure')
  })

  it('reports a browser with no Web MIDI', async () => {
    const c = new WebMidiConnection({ navigator: {} as Navigator, isSecureContext: true, now: () => 0 })
    expect((await c.open()).access).toBe('unsupported')
  })

  it('keeps the platform error text when permission is refused', async () => {
    const err = Object.assign(new Error('Permission denied.'), { name: 'NotAllowedError' })
    const { nav } = fakeNavigator([], err)
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 })
    expect(await c.open()).toMatchObject({ access: 'denied', error: 'NotAllowedError: Permission denied.' })
  })

  it('lists inputs, identifies the Yamaha, and emits parsed events', async () => {
    const yamaha = fakeInput('a', 'Digital Keyboard', 'Yamaha Corporation')
    const { nav } = fakeNavigator([yamaha])
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 105 })
    const snap = await c.open()
    expect(snap.access).toBe('granted')
    expect(snap.inputs[0]).toMatchObject({ name: 'Digital Keyboard', looksLikeYamaha: true })

    const got: MidiEvent[] = []
    c.onEvent((e) => got.push(e))
    yamaha.onmidimessage!({ data: new Uint8Array([0x90, 60, 74]), timeStamp: 100 })
    yamaha.onmidimessage!({ data: new Uint8Array([0x90, 60, 0]), timeStamp: 340 })
    expect(got.map((e) => e.type)).toEqual(['noteon', 'noteoff'])
    expect(got[0]).toMatchObject({ time: 100, receivedAt: 105, deviceId: 'a' })
  })

  it('binds an input plugged in after access was granted', async () => {
    const { nav, access } = fakeNavigator([])
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 })
    await c.open()
    const late = fakeInput('b', 'Digital Keyboard', 'Yamaha')
    access.inputs.set('b', late)
    const seen: string[] = []
    c.onChange((s) => seen.push(s.inputs.map((i) => i.id).join()))
    access.onstatechange!()
    expect(seen.at(-1)).toBe('b')
    expect(late.onmidimessage).toBeTypeOf('function')
  })

  it('falls back to arrival time when the platform timestamp is missing', async () => {
    const input = fakeInput('a', 'x', '')
    const { nav } = fakeNavigator([input])
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 77 })
    await c.open()
    const got: MidiEvent[] = []
    c.onEvent((e) => got.push(e))
    input.onmidimessage!({ data: new Uint8Array([0x90, 60, 1]), timeStamp: 0 })
    expect(got[0].time).toBe(77)
  })
})

describe('WebMidiConnection: sending', () => {
  const fakeOutput = (id: string, name: string, manufacturer: string) => ({ id, name, manufacturer, state: 'connected', send: vi.fn() })

  it('lists outputs and sends to the Yamaha in preference to anything else attached', async () => {
    const { nav, access } = fakeNavigator([])
    const other = fakeOutput('x', 'Some Synth', 'Acme')
    const yamaha = fakeOutput('y', 'Digital Keyboard', 'Yamaha Corporation')
    Object.assign(access, { outputs: new Map([['x', other], ['y', yamaha]]) })
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 })
    const snap = await c.open()
    expect(snap.outputs?.map((o) => [o.id, o.looksLikeYamaha])).toEqual([['x', false], ['y', true]])
    expect(c.send([0x90, 60, 90], 1234)).toBe(true)
    expect(yamaha.send).toHaveBeenCalledWith([0x90, 60, 90], 1234)
    expect(other.send).not.toHaveBeenCalled()
  })

  it('says so when there is nowhere to send', async () => {
    const { nav } = fakeNavigator([])
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 })
    expect(c.send([0x90, 60, 90])).toBe(false)
    await c.open()
    expect(c.send([0x90, 60, 90])).toBe(false)
  })

  it('treats a port that throws on send as nothing sent', async () => {
    const { nav, access } = fakeNavigator([])
    const broken = { ...fakeOutput('y', 'Digital Keyboard', 'Yamaha'), send: vi.fn(() => { throw new Error('InvalidStateError') }) }
    Object.assign(access, { outputs: new Map([['y', broken]]) })
    const c = new WebMidiConnection({ navigator: nav, isSecureContext: true, now: () => 0 })
    await c.open()
    expect(c.send([0x90, 60, 90])).toBe(false)
  })
})

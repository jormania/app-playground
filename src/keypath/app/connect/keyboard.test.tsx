// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SimulatedConnection } from '../../midi/simulatedConnection'
import type { MidiEvent } from '../../midi/types'
import { setKeyboardConnection, useKeyboard } from './keyboard'

afterEach(() => {
  cleanup()
  setKeyboardConnection(null)
})

function Screen({ onKey }: { onKey: (e: MidiEvent) => void }) {
  useKeyboard(onKey)
  return null
}

describe('one key press, heard once', () => {
  it('after leaving a screen and coming back, and after the keyboard is unplugged and plugged in again', async () => {
    const yamaha = new SimulatedConnection()
    setKeyboardConnection(yamaha)
    await yamaha.open()
    const heard: number[] = []
    const onKey = (e: MidiEvent) => e.type === 'noteon' && heard.push(e.note)

    // A screen, then away, then back three times (each with a new handler, as a re-render gives).
    for (let i = 0; i < 3; i++) {
      const view = render(<Screen onKey={(e) => onKey(e)} />)
      view.unmount()
    }
    render(<Screen onKey={(e) => onKey(e)} />)
    act(() => yamaha.press(60))
    expect(heard).toEqual([60])

    // Unplugged and plugged back in: still once.
    yamaha.close()
    await yamaha.open()
    act(() => yamaha.press(62))
    expect(heard).toEqual([60, 62])
  })
})

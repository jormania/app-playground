// @vitest-environment happy-dom
// Regression test for a real production bug: typing in the Place field never triggered a
// search. Root cause — PlaceInput compared the typed query against the `value` prop to
// decide whether to search, but every keystroke round-trips through the parent (onChange
// -> EntryEditor's `place` state -> back down as `value`), so that comparison was true on
// every single keystroke, permanently skipping the search. Fixed with a skip-once ref that
// only suppresses the debounce after a *programmatic* query change (picking a suggestion),
// not after normal typing.
import { useState } from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlaceInput from './PlaceInput.jsx'
import * as placesClient from './placesClient.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

// A stateful wrapper mirroring exactly how EntryEditor uses PlaceInput: `place` is owned by
// the parent and fed back down as `value` on every change — the shape that triggered the bug.
function ControlledPlaceInput() {
  const [place, setPlace] = useState('')
  const [placeUrl, setPlaceUrl] = useState('')
  return <PlaceInput value={place} url={placeUrl} onChange={({ place: p, placeUrl: u }) => { setPlace(p); setPlaceUrl(u) }} />
}

describe('PlaceInput — search actually fires while typing', () => {
  it('calls the autocomplete API after typing 2+ characters, despite the value round-trip', async () => {
    const spy = vi.spyOn(placesClient, 'autocomplete').mockResolvedValue({
      configured: true,
      predictions: [{ description: 'Cinema Pro, București', placeId: 'abc123' }],
    })

    render(<ControlledPlaceInput />)
    const input = screen.getByPlaceholderText('search for a place…')

    // Type character-by-character, exactly like a real user — each keystroke round-trips
    // through the parent's controlled `value`, which is precisely what broke the old check.
    await userEvent.type(input, 'cinema')

    // Debounce is 250ms; wait past it.
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 1000 })
    expect(spy).toHaveBeenCalledWith('cinema', expect.any(String), expect.anything())

    // The suggestion should actually render.
    await waitFor(() => expect(screen.getByText('Cinema Pro, București')).toBeTruthy())
  })

  it('does not re-search immediately after picking a suggestion (no redundant call)', async () => {
    const spy = vi.spyOn(placesClient, 'autocomplete').mockResolvedValue({
      configured: true,
      predictions: [{ description: 'Cinema Pro, București', placeId: 'abc123' }],
    })
    vi.spyOn(placesClient, 'details').mockResolvedValue({
      configured: true,
      place: { name: 'Cinema Pro', mapsUrl: 'https://maps.example/pin' },
    })

    render(<ControlledPlaceInput />)
    const input = screen.getByPlaceholderText('search for a place…')
    await userEvent.type(input, 'cinema')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    fireEvent.mouseDown(screen.getByText('Cinema Pro, București'))
    fireEvent.click(screen.getByText('Cinema Pro, București'))

    // Give the debounce window a chance to fire a second time, then assert it didn't.
    await act(async () => new Promise(r => setTimeout(r, 350)))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not search below 2 characters', async () => {
    const spy = vi.spyOn(placesClient, 'autocomplete').mockResolvedValue({ configured: true, predictions: [] })
    render(<ControlledPlaceInput />)
    const input = screen.getByPlaceholderText('search for a place…')
    await userEvent.type(input, 'c')
    await act(async () => new Promise(r => setTimeout(r, 350)))
    expect(spy).not.toHaveBeenCalled()
  })
})

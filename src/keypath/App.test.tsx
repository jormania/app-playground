// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

afterEach(cleanup)

describe('KeyPath probe', () => {
  it('says plainly when the browser has no Web MIDI', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI' }))
    // happy-dom has no requestMIDIAccess — exactly the Firefox-for-Android case.
    expect(await screen.findByText(/no Web MIDI|not a secure context/)).toBeTruthy()
  })

  it('offers the phone-audio check for the real keyboard, and hides it in the simulator', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Play test tone' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Simulator' }))
    await screen.findByRole('button', { name: 'Sound on' })
    expect(screen.queryByRole('button', { name: 'Play test tone' })).toBeNull()
  })

  it('in simulator mode, a pressed key shows as held and lands in the log', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('radio', { name: 'Simulator' }))
    const c4 = await screen.findByRole('button', { name: 'C4' })
    fireEvent.pointerDown(c4, { pointerId: 1 })
    await waitFor(() => expect(screen.getAllByText('Note On').length).toBeGreaterThan(0))
    expect(c4.getAttribute('aria-pressed')).toBe('true')
    fireEvent.pointerUp(c4, { pointerId: 1 })
    await waitFor(() => expect(c4.getAttribute('aria-pressed')).toBe('false'))
    expect(screen.getByText('No keys held')).toBeTruthy()
  })
})

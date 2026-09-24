// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('KeyPath probe', () => {
  it('asks for a screen wake lock as soon as it opens, before anything is connected', async () => {
    const request = vi.fn().mockResolvedValue({ addEventListener: () => {}, release: () => Promise.resolve() })
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    render(<App />)
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
    delete (navigator as { wakeLock?: unknown }).wakeLock
  })

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

  it('keeps KeyPath’s sound to the keyboard at 0 until turned on, and remembers the level', () => {
    render(<App />)
    const slider = screen.getByRole('slider', { name: 'KeyPath sound volume' }) as HTMLInputElement
    expect(slider.value).toBe('0')
    expect((screen.getByRole('button', { name: 'Preview' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(slider.value).toBe('50')
    fireEvent.change(slider, { target: { value: '80' } })
    cleanup()
    render(<App />)
    expect((screen.getByRole('slider', { name: 'KeyPath sound volume' }) as HTMLInputElement).value).toBe('80')
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

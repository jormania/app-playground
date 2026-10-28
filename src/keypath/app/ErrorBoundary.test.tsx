// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
import { keepsAwake } from './Shell'

vi.mock('../App', () => ({ default: () => <div>probe screen</div> }))
afterEach(cleanup)

function Broken(): never {
  throw new Error('a screen that can’t draw')
}

describe('ErrorBoundary', () => {
  it('shows what happened and the way back, instead of an empty page', () => {
    const home = vi.fn()
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary title="Something went wrong on this screen." body="Nothing is lost." home="Back to Home" reload="Reload KeyPath" onHome={home}>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(home).toHaveBeenCalled()
    quiet.mockRestore()
  })
})

describe('keepsAwake', () => {
  it('keeps the screen on where she plays, and lets it sleep everywhere else', () => {
    for (const r of [{ name: 'play', songId: 'x' }, { name: 'challenge', game: 'race' }, { name: 'journeyStep', step: 'cde' }, { name: 'studio', songId: 'x' }, { name: 'door', door: 'studio' }, { name: 'connect' }] as const) expect(keepsAwake(r)).toBe(true)
    for (const r of [{ name: 'home' }, { name: 'settings' }, { name: 'progress' }, { name: 'who' }, { name: 'door', door: 'songs' }, { name: 'door', door: 'challenges' }] as const) expect(keepsAwake(r)).toBe(false)
  })
})

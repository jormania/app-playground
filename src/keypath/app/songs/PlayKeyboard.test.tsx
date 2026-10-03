// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlayKeyboard } from './PlayKeyboard'
import { keyBoxes } from './keyGeometry'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const NONE = new Set<number>()
/** The keyboard drawn at this size (px): happy-dom lays nothing out, so the size is given. */
function drawAt(width: number, height: number, low: number, high: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
  const { container } = render(
    <PlayKeyboard boxes={keyBoxes(low, high)} held={NONE} targets={NONE} wrong={NONE} label={String} onPress={() => {}} onRelease={() => {}} />,
  )
  return container.querySelector('[data-pitch]')!.parentElement!
}

describe('black keys standing above the white ones', () => {
  it('where a black key has room: one octave on a phone held upright, or two on its side', () => {
    expect(drawAt(388, 112, 60, 72).dataset.raised).toBe('true')
    expect(drawAt(890, 104, 48, 84).dataset.raised).toBe('true')
  })

  it('not where the keys are narrow (two octaves upright) or the keyboard short', () => {
    expect(drawAt(388, 112, 60, 84).dataset.raised).toBeUndefined()
    expect(drawAt(890, 64, 48, 84).dataset.raised).toBeUndefined()
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { readImageViewMode, writeImageViewMode } from './imageViewPref'

describe('imageViewPref', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for a thing with no stored preference', () => {
    expect(readImageViewMode('thing-1')).toBeNull()
  })

  it('round-trips a stored preference', () => {
    writeImageViewMode('thing-1', 'image')
    expect(readImageViewMode('thing-1')).toBe('image')
  })

  it('keeps preferences for different things independent', () => {
    writeImageViewMode('thing-1', 'image')
    writeImageViewMode('thing-2', 'text')
    expect(readImageViewMode('thing-1')).toBe('image')
    expect(readImageViewMode('thing-2')).toBe('text')
  })

  it('overwrites an existing preference for the same thing', () => {
    writeImageViewMode('thing-1', 'image')
    writeImageViewMode('thing-1', 'text')
    expect(readImageViewMode('thing-1')).toBe('text')
  })
})

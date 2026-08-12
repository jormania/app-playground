// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { snapshot, applyUndo, peekUndo, clearUndo } from './undo'

describe('undo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('restores the values a destructive action replaced', () => {
    localStorage.setItem('lexi5_stats', JSON.stringify({ standard: { gamesPlayed: 42 } }))

    snapshot('stats', 'Statistics reset')
    localStorage.setItem('lexi5_stats', JSON.stringify({ standard: { gamesPlayed: 0 } }))

    expect(applyUndo()).toEqual({ scope: 'stats', label: 'Statistics reset' })
    expect(JSON.parse(localStorage.getItem('lexi5_stats'))).toEqual({ standard: { gamesPlayed: 42 } })
  })

  it('removes keys that did not exist before, rather than leaving them behind', () => {
    // Undoing a first-ever curation has to delete the list, not restore an empty one —
    // a snapshot records absence as null and must replay it as a removal.
    expect(localStorage.getItem('lexi5_custom_dict')).toBeNull()

    snapshot('customList', 'Word list refreshed')
    localStorage.setItem('lexi5_custom_dict', JSON.stringify(['apple']))
    localStorage.setItem('lexi5_custom_dict_epoch', '123')

    applyUndo()
    expect(localStorage.getItem('lexi5_custom_dict')).toBeNull()
    expect(localStorage.getItem('lexi5_custom_dict_epoch')).toBeNull()
  })

  it('restores every key in the scope together', () => {
    localStorage.setItem('lexi5_custom_dict', JSON.stringify(['apple', 'mango']))
    localStorage.setItem('lexi5_custom_dict_epoch', '100')
    localStorage.setItem('lexi5_custom_dict_theme', JSON.stringify('Animals'))

    snapshot('customList', 'Word list refreshed')
    localStorage.setItem('lexi5_custom_dict', JSON.stringify(['zebra']))
    localStorage.setItem('lexi5_custom_dict_epoch', '200')
    localStorage.removeItem('lexi5_custom_dict_theme')

    applyUndo()
    expect(JSON.parse(localStorage.getItem('lexi5_custom_dict'))).toEqual(['apple', 'mango'])
    expect(JSON.parse(localStorage.getItem('lexi5_custom_dict_epoch'))).toBe(100)
    expect(JSON.parse(localStorage.getItem('lexi5_custom_dict_theme'))).toBe('Animals')
  })

  it('is a single slot — a second snapshot replaces the first', () => {
    localStorage.setItem('lexi5_stats', JSON.stringify({ n: 1 }))
    snapshot('stats', 'first')
    localStorage.setItem('lexi5_stats', JSON.stringify({ n: 2 }))
    snapshot('stats', 'second')
    localStorage.setItem('lexi5_stats', JSON.stringify({ n: 3 }))

    expect(applyUndo().label).toBe('second')
    expect(JSON.parse(localStorage.getItem('lexi5_stats'))).toEqual({ n: 2 })
  })

  it('can only be applied once', () => {
    localStorage.setItem('lexi5_stats', JSON.stringify({ n: 1 }))
    snapshot('stats', 'Statistics reset')
    localStorage.setItem('lexi5_stats', JSON.stringify({ n: 2 }))

    expect(applyUndo()).not.toBeNull()
    expect(applyUndo()).toBeNull()
  })

  it('reports nothing pending after being cleared', () => {
    snapshot('stats', 'Statistics reset')
    expect(peekUndo()).not.toBeNull()
    clearUndo()
    expect(peekUndo()).toBeNull()
  })

  it('ignores an unknown scope rather than restoring arbitrary keys', () => {
    localStorage.setItem('lexi5_undo', JSON.stringify({ scope: 'everything', values: { evil: 1 } }))
    expect(peekUndo()).toBeNull()
    expect(applyUndo()).toBeNull()
  })
})

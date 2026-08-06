import { describe, it, expect } from 'vitest'
import {
  sortWardrobes, activeWardrobes, nextOrder, isGarmentHidden, unassignedGarments,
  resolveFilter, visibleGarments, wardrobesForGarment, garmentCount,
  checkWardrobeName, describeDeletion, isLastActive, type Wardrobe,
} from './wardrobes.ts'
import type { Garment } from './types.ts'

const wardrobe = (id: string, over: Partial<Wardrobe> = {}): Wardrobe =>
  ({ id, name: id, active: true, order: 1, ...over })

const garment = (id: string, wardrobeIds: string[]): Garment => ({
  id, name: id, photoUrl: null, thumb: null, category: 'Top', colours: [],
  warmth: null, styles: [], wardrobeIds, favourite: false, wearCount: 0,
  lastWorn: null, archived: false,
})

describe('sortWardrobes', () => {
  it('orders by order, then name, then id — always stable', () => {
    const list = [
      wardrobe('c', { order: 2, name: 'Bee' }),
      wardrobe('a', { order: 1, name: 'Zed' }),
      wardrobe('b', { order: 2, name: 'Ant' }),
    ]
    expect(sortWardrobes(list).map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate its input', () => {
    const list = [wardrobe('b', { order: 2 }), wardrobe('a', { order: 1 })]
    sortWardrobes(list)
    expect(list.map((w) => w.id)).toEqual(['b', 'a'])
  })
})

describe('nextOrder', () => {
  it('places a new wardrobe after everything else', () => {
    expect(nextOrder([wardrobe('a', { order: 1 }), wardrobe('b', { order: 7 })])).toBe(8)
  })
  it('starts at 1 when there are none', () => expect(nextOrder([])).toBe(1))
})

describe('isGarmentHidden — the core visibility rule', () => {
  const mum = wardrobe('mum')
  const dad = wardrobe('dad', { active: false })

  it('shows a garment in an active wardrobe', () => {
    expect(isGarmentHidden(garment('g', ['mum']), [mum, dad])).toBe(false)
  })

  it('hides a garment only in an inactive wardrobe', () => {
    expect(isGarmentHidden(garment('g', ['dad']), [mum, dad])).toBe(true)
  })

  it('shows a garment in one active and one inactive wardrobe', () => {
    // Switching one wardrobe off must never remove clothes from another.
    expect(isGarmentHidden(garment('g', ['mum', 'dad']), [mum, dad])).toBe(false)
  })

  it('never hides a garment that belongs to no wardrobe', () => {
    // Reachable by deleting a wardrobe. Hiding these would make clothes vanish
    // with no way to find them again.
    expect(isGarmentHidden(garment('g', []), [mum, dad])).toBe(false)
    expect(isGarmentHidden(garment('g', []), [])).toBe(false)
  })

  it('does NOT hide a garment whose wardrobes no longer exist', () => {
    // A stale reference makes the garment effectively unfiled, not invisible.
    expect(isGarmentHidden(garment('g', ['ghost']), [mum])).toBe(false)
  })

  it('hides nothing when no wardrobes exist at all', () => {
    // The Wardrobes database id is its own Settings field. Configure Garments
    // first and this is the state you land in — it must not empty the app.
    expect(isGarmentHidden(garment('g', ['mum']), [])).toBe(false)
  })

  it('hides everything when every wardrobe is off', () => {
    const off = [wardrobe('a', { active: false }), wardrobe('b', { active: false })]
    expect(isGarmentHidden(garment('g', ['a']), off)).toBe(true)
  })
})

describe('resolveFilter', () => {
  const mum = wardrobe('mum')
  const dad = wardrobe('dad', { active: false })

  it('keeps a filter on an active wardrobe', () => {
    expect(resolveFilter('mum', [mum, dad])).toBe('mum')
  })
  it('falls back to All when the wardrobe was deleted', () => {
    // The filter is stored on the device and easily outlives the wardrobe.
    expect(resolveFilter('gone', [mum])).toBe(null)
  })
  it('falls back to All when the wardrobe was switched off', () => {
    expect(resolveFilter('dad', [mum, dad])).toBe(null)
  })
  it('passes All straight through', () => expect(resolveFilter(null, [mum])).toBe(null))
})

describe('visibleGarments', () => {
  const mum = wardrobe('mum', { order: 1 })
  const dad = wardrobe('dad', { order: 2 })
  const nan = wardrobe('nan', { order: 3, active: false })
  const all = [mum, dad, nan]
  const garments = [
    garment('atMum', ['mum']),
    garment('atDad', ['dad']),
    garment('atBoth', ['mum', 'dad']),
    garment('atNanOnly', ['nan']),
    garment('unfiled', []),
  ]

  it('All shows everything except what inactive wardrobes hide', () => {
    expect(visibleGarments(garments, all, null).map((g) => g.id))
      .toEqual(['atMum', 'atDad', 'atBoth', 'unfiled'])
  })

  it('with the Wardrobes database not yet configured, nothing is hidden', () => {
    // Regression guard: this returned a single garment before the visibility
    // rule required a wardrobe to actually exist before it could hide anything.
    expect(visibleGarments(garments, [], null)).toHaveLength(garments.length)
  })

  it('a specific wardrobe shows exactly its members', () => {
    expect(visibleGarments(garments, all, 'mum').map((g) => g.id))
      .toEqual(['atMum', 'atBoth'])
  })

  it('filtering to a deleted wardrobe degrades to All rather than showing nothing', () => {
    expect(visibleGarments(garments, all, 'gone').map((g) => g.id))
      .toEqual(['atMum', 'atDad', 'atBoth', 'unfiled'])
  })

  it('with every wardrobe off, only unfiled clothes remain', () => {
    const off = all.map((w) => ({ ...w, active: false }))
    expect(visibleGarments(garments, off, null).map((g) => g.id)).toEqual(['unfiled'])
  })

  it('with no wardrobes at all, everything is visible', () => {
    // First run, before Nora has made any — the app must not look broken.
    expect(visibleGarments(garments, [], null)).toHaveLength(garments.length)
  })
})

describe('unassignedGarments', () => {
  it('finds clothes left behind by a deleted wardrobe', () => {
    const list = [garment('a', ['mum']), garment('b', []), garment('c', [])]
    expect(unassignedGarments(list).map((g) => g.id)).toEqual(['b', 'c'])
  })
})

describe('wardrobesForGarment', () => {
  it('returns the garment’s wardrobes in display order', () => {
    const ws = [wardrobe('b', { order: 2 }), wardrobe('a', { order: 1 }), wardrobe('c', { order: 3 })]
    expect(wardrobesForGarment(garment('g', ['c', 'a']), ws).map((w) => w.id)).toEqual(['a', 'c'])
  })
  it('ignores ids with no matching wardrobe', () => {
    expect(wardrobesForGarment(garment('g', ['ghost']), [wardrobe('a')])).toEqual([])
  })
})

describe('garmentCount', () => {
  it('counts members regardless of active state', () => {
    const list = [garment('a', ['mum']), garment('b', ['mum', 'dad']), garment('c', ['dad'])]
    expect(garmentCount('mum', list)).toBe(2)
  })
})

describe('checkWardrobeName', () => {
  const existing = [wardrobe('1', { name: "Mum's" })]

  it('accepts a fresh name', () => expect(checkWardrobeName('Dad’s', existing).ok).toBe(true))

  it('refuses an empty or whitespace name', () => {
    expect(checkWardrobeName('', existing).ok).toBe(false)
    expect(checkWardrobeName('   ', existing).ok).toBe(false)
  })

  it('refuses an absurdly long name', () => {
    expect(checkWardrobeName('x'.repeat(61), existing).ok).toBe(false)
  })

  it('warns about a duplicate but still allows it', () => {
    // Two places really can share a name; that is Nora's call, not the app's.
    const result = checkWardrobeName("mum's", existing)
    expect(result.ok).toBe(true)
    expect(result.warning).toBeTruthy()
  })

  it('does not flag a wardrobe against itself when renaming', () => {
    expect(checkWardrobeName("Mum's", existing, '1').warning).toBeUndefined()
  })
})

describe('describeDeletion', () => {
  it('says plainly that an empty wardrobe changes nothing else', () => {
    expect(describeDeletion(wardrobe('a', { name: 'Spare' }), []).message).toContain('empty')
  })

  it('names the count and promises the clothes survive', () => {
    const garments = [garment('x', ['a']), garment('y', ['a'])]
    const { count, message } = describeDeletion(wardrobe('a', { name: 'Spare' }), garments)
    expect(count).toBe(2)
    expect(message).toContain('2 things')
    expect(message).toContain("stay in your wardrobe")
  })

  it('gets the singular right', () => {
    const { message } = describeDeletion(wardrobe('a'), [garment('x', ['a'])])
    expect(message).toContain('1 thing')
    expect(message).not.toContain('1 things')
  })
})

describe('isLastActive', () => {
  it('spots the final active wardrobe', () => {
    const ws = [wardrobe('a'), wardrobe('b', { active: false })]
    expect(isLastActive('a', ws)).toBe(true)
  })
  it('is false when others remain on', () => {
    expect(isLastActive('a', [wardrobe('a'), wardrobe('b')])).toBe(false)
  })
  it('is false for an already-inactive wardrobe', () => {
    expect(isLastActive('b', [wardrobe('a'), wardrobe('b', { active: false })])).toBe(false)
  })
})

describe('activeWardrobes', () => {
  it('returns only active ones, in order', () => {
    const ws = [
      wardrobe('c', { order: 3 }),
      wardrobe('a', { order: 1 }),
      wardrobe('b', { order: 2, active: false }),
    ]
    expect(activeWardrobes(ws).map((w) => w.id)).toEqual(['a', 'c'])
  })
})

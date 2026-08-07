import { describe, it, expect } from 'vitest'
import {
  recommend, scoreGarment, targetWarmth, isWet, daysSince, explain,
  alternativesFor, swapPiece,
  type RecommendContext,
} from './recommend.ts'
import type { Garment } from './types.ts'

const g = (id: string, over: Partial<Garment> = {}): Garment => ({
  id, name: id, photoUrl: null, thumb: null, category: 'Top', colours: ['black'],
  warmth: 'Mid', styles: ['casual'], wardrobeIds: ['w'], favourite: false,
  wearCount: 0, lastWorn: null, archived: false, retired: false, ...over,
})

const ctx = (over: Partial<RecommendContext> = {}): RecommendContext => ({
  temp: 18, condition: 'clear', wind: 5, mood: null, today: '2026-08-06', ...over,
})

/** A wardrobe with enough of everything to build real outfits from. */
const wardrobe = (): Garment[] => [
  g('tee', { category: 'Top', warmth: 'Light', styles: ['casual', 'summery'], colours: ['white'] }),
  g('hoodie', { category: 'Top', warmth: 'Warm', styles: ['cosy', 'casual'], colours: ['black'] }),
  g('shirt', { category: 'Top', warmth: 'Mid', styles: ['smart'], colours: ['blue'] }),
  g('jeans', { category: 'Bottom', warmth: 'Mid', styles: ['casual'], colours: ['denim'] }),
  g('shorts', { category: 'Bottom', warmth: 'Light', styles: ['summery'], colours: ['beige'] }),
  g('trousers', { category: 'Bottom', warmth: 'Warm', styles: ['smart'], colours: ['grey'] }),
  g('trainers', { category: 'Shoes', warmth: 'Light', styles: ['casual', 'sporty'], colours: ['white'] }),
  g('boots', { category: 'Shoes', warmth: 'Warm', styles: ['smart'], colours: ['black'] }),
  g('coat', { category: 'Outerwear', warmth: 'Warm', styles: ['cosy'], colours: ['navy'] }),
  g('mac', { category: 'Outerwear', warmth: 'Mid', styles: ['layering'], colours: ['yellow'] }),
  g('dress', { category: 'Dress', warmth: 'Light', styles: ['summery', 'going-out'], colours: ['pink'] }),
]

describe('targetWarmth', () => {
  it('maps temperature to what you should be wearing', () => {
    expect(targetWarmth(28)).toBe('Light')
    expect(targetWarmth(22)).toBe('Light')
    expect(targetWarmth(18)).toBe('Mid')
    expect(targetWarmth(12)).toBe('Mid')
    expect(targetWarmth(4)).toBe('Warm')
    expect(targetWarmth(-5)).toBe('Warm')
  })
  it('has no opinion without a temperature', () => expect(targetWarmth(null)).toBe(null))
})

describe('isWet', () => {
  it('treats rain, snow and storms alike', () => {
    expect(isWet('rain')).toBe(true)
    expect(isWet('snow')).toBe(true)
    expect(isWet('thunder')).toBe(true)
    expect(isWet('clear')).toBe(false)
    expect(isWet('overcast')).toBe(false)
  })
})

describe('daysSince', () => {
  it('counts whole days', () => expect(daysSince('2026-08-01', '2026-08-06')).toBe(5))
  it('handles same day', () => expect(daysSince('2026-08-06', '2026-08-06')).toBe(0))
  it('crosses a month boundary', () => expect(daysSince('2026-07-30', '2026-08-02')).toBe(3))
  it('returns null for a garment never worn', () => expect(daysSince(null, '2026-08-06')).toBe(null))
  it('returns null for junk rather than NaN', () => expect(daysSince('never', '2026-08-06')).toBe(null))
})

describe('scoreGarment — warmth is the strongest signal', () => {
  it('rewards the right warmth', () => {
    expect(scoreGarment(g('a', { warmth: 'Warm' }), ctx({ temp: 2 })).total)
      .toBeGreaterThan(scoreGarment(g('a', { warmth: 'Light' }), ctx({ temp: 2 })).total)
  })

  it('punishes the opposite warmth hard', () => {
    // A puffer coat in July must sink, not merely rank low.
    expect(scoreGarment(g('a', { warmth: 'Warm' }), ctx({ temp: 30 })).total).toBeLessThan(0)
  })

  it('ignores warmth entirely when there is no weather', () => {
    const warm = scoreGarment(g('a', { warmth: 'Warm' }), ctx({ temp: null })).total
    const light = scoreGarment(g('a', { warmth: 'Light' }), ctx({ temp: null })).total
    expect(warm).toBe(light)
  })
})

describe('scoreGarment — mood, weather, favourites, recency', () => {
  it('favours styles that match the mood', () => {
    const cosy = g('a', { styles: ['cosy', 'casual'] })
    expect(scoreGarment(cosy, ctx({ mood: 'Comfy' })).total)
      .toBeGreaterThan(scoreGarment(cosy, ctx({ mood: null })).total)
  })

  it('boosts outerwear and penalises summery things in the rain', () => {
    expect(scoreGarment(g('a', { category: 'Outerwear' }), ctx({ condition: 'rain' })).total)
      .toBeGreaterThan(scoreGarment(g('a', { category: 'Outerwear' }), ctx({ condition: 'clear' })).total)
    expect(scoreGarment(g('a', { styles: ['summery'] }), ctx({ condition: 'rain' })).total)
      .toBeLessThan(scoreGarment(g('a', { styles: ['summery'] }), ctx({ condition: 'overcast' })).total)
  })

  it('nudges towards favourites', () => {
    expect(scoreGarment(g('a', { favourite: true }), ctx()).total)
      .toBeGreaterThan(scoreGarment(g('a', { favourite: false }), ctx()).total)
  })

  it('never lets a favourite beat the weather', () => {
    // A favourite T-shirt should not win in February.
    const favLight = g('a', { warmth: 'Light', favourite: true })
    const plainWarm = g('b', { warmth: 'Warm', favourite: false })
    expect(scoreGarment(favLight, ctx({ temp: 2 })).total)
      .toBeLessThan(scoreGarment(plainWarm, ctx({ temp: 2 })).total)
  })

  it('nudges away from what was worn yesterday', () => {
    expect(scoreGarment(g('a', { lastWorn: '2026-08-05' }), ctx()).total)
      .toBeLessThan(scoreGarment(g('a', { lastWorn: null }), ctx()).total)
  })

  it('nudges towards something long forgotten', () => {
    expect(scoreGarment(g('a', { lastWorn: '2026-05-01' }), ctx()).total)
      .toBeGreaterThan(scoreGarment(g('a', { lastWorn: '2026-08-04' }), ctx()).total)
  })
})

describe('recommend — shape of an outfit', () => {
  it('gives three suggestions from a full wardrobe', () => {
    expect(recommend(wardrobe(), ctx())).toHaveLength(3)
  })

  it('every outfit has something on top and something on the feet', () => {
    for (const outfit of recommend(wardrobe(), ctx())) {
      const cats = outfit.garments.map((g) => g.category)
      const covered = cats.includes('Dress') || (cats.includes('Top') && cats.includes('Bottom'))
      expect(covered).toBe(true)
      expect(cats).toContain('Shoes')
    }
  })

  it('never repeats a garment within one outfit', () => {
    for (const outfit of recommend(wardrobe(), ctx())) {
      const ids = outfit.garments.map((g) => g.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('makes the three visibly different, not variations on one shirt', () => {
    const ids = recommend(wardrobe(), ctx()).map((o) => o.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('varies the shoes when the wardrobe has more than one pair', () => {
    // Regression: the first cut only excluded the anchor between rounds, so all
    // three outfits came back wearing the same boots. It scored fine and read
    // as the app repeating itself.
    const shoes = recommend(wardrobe(), ctx())
      .flatMap((o) => o.garments.filter((g) => g.category === 'Shoes').map((g) => g.id))
    expect(new Set(shoes).size).toBeGreaterThan(1)
  })

  it('still repeats the only pair of shoes rather than going barefoot', () => {
    // Variety is a preference, not a rule — one pair of shoes beats none.
    const thin = [
      g('tee', { category: 'Top' }), g('shirt', { category: 'Top' }),
      g('jeans', { category: 'Bottom' }), g('shorts', { category: 'Bottom' }),
      g('only-shoes', { category: 'Shoes' }),
    ]
    const outfits = recommend(thin, ctx())
    expect(outfits.length).toBeGreaterThan(1)
    for (const o of outfits) {
      expect(o.garments.map((x) => x.id)).toContain('only-shoes')
    }
  })
})

describe('recommend — responds to the weather', () => {
  it('adds a coat when it rains', () => {
    const outfits = recommend(wardrobe(), ctx({ condition: 'rain' }))
    expect(outfits[0].garments.some((g) => g.category === 'Outerwear')).toBe(true)
  })

  it('adds a coat when it is cold', () => {
    const outfits = recommend(wardrobe(), ctx({ temp: 3 }))
    expect(outfits[0].garments.some((g) => g.category === 'Outerwear')).toBe(true)
  })

  it('leaves the coat behind on a warm clear day', () => {
    const outfits = recommend(wardrobe(), ctx({ temp: 28, condition: 'clear' }))
    expect(outfits[0].garments.some((g) => g.category === 'Outerwear')).toBe(false)
  })

  it('dresses for cold weather with warm things', () => {
    const [best] = recommend(wardrobe(), ctx({ temp: 0 }))
    expect(best.garments.some((g) => g.warmth === 'Warm')).toBe(true)
  })

  it('does not put a winter coat on a summer day', () => {
    const outfits = recommend(wardrobe(), ctx({ temp: 30, condition: 'clear' }))
    expect(outfits[0].garments.map((g) => g.id)).not.toContain('coat')
  })
})

describe('recommend — determinism', () => {
  it('gives identical results for identical input', () => {
    const a = recommend(wardrobe(), ctx())
    const b = recommend(wardrobe(), ctx())
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id))
    expect(a.map((o) => o.score)).toEqual(b.map((o) => o.score))
  })

  it('is unaffected by the order garments arrive in', () => {
    const forwards = recommend(wardrobe(), ctx()).map((o) => o.id)
    const backwards = recommend([...wardrobe()].reverse(), ctx()).map((o) => o.id)
    expect(backwards).toEqual(forwards)
  })
})

describe('recommend — thin and awkward wardrobes', () => {
  it('returns nothing rather than nonsense when the wardrobe is empty', () => {
    expect(recommend([], ctx())).toEqual([])
  })

  it('returns nothing when there are tops but nothing to wear with them', () => {
    // A top on its own is not an outfit.
    expect(recommend([g('tee', { category: 'Top' })], ctx())).toEqual([])
  })

  it('manages without shoes rather than giving up', () => {
    const outfits = recommend([
      g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' }),
    ], ctx())
    expect(outfits).toHaveLength(1)
    expect(outfits[0].garments.map((g) => g.id)).toEqual(['tee', 'jeans'])
  })

  it('builds an outfit from a dress alone', () => {
    const outfits = recommend([g('dress', { category: 'Dress' })], ctx())
    expect(outfits[0].garments.map((g) => g.id)).toEqual(['dress'])
  })

  it('offers fewer than three rather than repeating itself', () => {
    const outfits = recommend([
      g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' }),
      g('shorts', { category: 'Bottom' }),
    ], ctx())
    expect(outfits.length).toBeLessThan(3)
    expect(new Set(outfits.map((o) => o.id)).size).toBe(outfits.length)
  })

  it('ignores put-away garments entirely', () => {
    const outfits = recommend([
      g('old', { category: 'Top', archived: true }),
      g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' }),
    ], ctx())
    for (const o of outfits) expect(o.garments.map((g) => g.id)).not.toContain('old')
  })

  it('ignores retired garments entirely', () => {
    // Defense in depth: Today already filters retired garments out before
    // calling recommend(), but recommend() shouldn't trust that — the same
    // way it doesn't trust callers not to pass archived garments.
    const outfits = recommend([
      g('gone', { category: 'Top', retired: true }),
      g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' }),
    ], ctx())
    for (const o of outfits) expect(o.garments.map((g) => g.id)).not.toContain('gone')
  })
})

describe('explain', () => {
  it('always says something', () => {
    expect(explain([g('a')], ctx()).length).toBeGreaterThan(0)
  })

  it('mentions the temperature when that is why', () => {
    expect(explain([g('a', { warmth: 'Warm' })], ctx({ temp: 2 })).toLowerCase())
      .toContain('right for the temperature')
  })

  it('mentions the mood when one is set', () => {
    expect(explain([g('a', { styles: ['cosy'] })], ctx({ mood: 'Comfy' })).toLowerCase())
      .toContain('comfy')
  })

  it('reads as a sentence', () => {
    const text = explain([g('a', { warmth: 'Warm', favourite: true })], ctx({ temp: 2 }))
    expect(text[0]).toBe(text[0].toUpperCase())
    expect(text.endsWith('.')).toBe(true)
  })

  it('falls back gracefully when there is nothing to say', () => {
    expect(explain([], ctx())).toBe('A simple option for today.')
  })
})

describe('Quick Swap — alternativesFor', () => {
  const outfitOf = (...ids: string[]) => {
    const all = wardrobe()
    const garments = ids.map((id) => all.find((g) => g.id === id)!)
    return { slot: 0, id: ids.slice().sort().join('+'), garments, score: 0, why: '' }
  }

  it('offers every same-category garment, current one included', () => {
    // The current piece stays in the list on purpose — that ring is what lets
    // swapPiece cycle back to where it started without tracking an index.
    const alts = alternativesFor(outfitOf('tee', 'jeans', 'trainers'), 'trainers', wardrobe(), ctx())
    expect(alts.map((g) => g.id).sort()).toEqual(['boots', 'trainers'])
  })

  it('never offers something already worn elsewhere in the same outfit', () => {
    const twoShoes = [...wardrobe(), g('sandals', { category: 'Shoes' })]
    const outfit = { ...outfitOf('tee', 'jeans', 'trainers') }
    outfit.garments = [...outfit.garments, twoShoes.find((x) => x.id === 'boots')!]
    const alts = alternativesFor(outfit, 'trainers', twoShoes, ctx())
    expect(alts.map((g) => g.id)).not.toContain('boots')
  })

  it('ranks alternatives by how well they suit today', () => {
    const alts = alternativesFor(outfitOf('tee', 'jeans', 'trainers'), 'trainers', wardrobe(), ctx({ temp: 0 }))
    // Freezing: the warm boots should outrank the light trainers.
    expect(alts[0].id).toBe('boots')
  })

  it('ignores put-away garments', () => {
    const withArchived = [...wardrobe(), g('old-shoes', { category: 'Shoes', archived: true })]
    const alts = alternativesFor(outfitOf('tee', 'jeans', 'trainers'), 'trainers', withArchived, ctx())
    expect(alts.map((g) => g.id)).not.toContain('old-shoes')
  })

  it('returns nothing for a garment that is not in the outfit', () => {
    expect(alternativesFor(outfitOf('tee', 'jeans'), 'boots', wardrobe(), ctx())).toEqual([])
  })

  it('never offers a retired garment as a swap', () => {
    const withRetired = [...wardrobe(), g('retired-shoes', { category: 'Shoes', retired: true })]
    const alts = alternativesFor(outfitOf('tee', 'jeans', 'trainers'), 'trainers', withRetired, ctx())
    expect(alts.map((g) => g.id)).not.toContain('retired-shoes')
  })
})

describe('Quick Swap — swapPiece', () => {
  const build = (over: Partial<RecommendContext> = {}) => {
    const [outfit] = recommend(wardrobe(), ctx(over))
    return outfit
  }

  it('changes only the piece asked for', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    const after = swapPiece(before, shoes.id, wardrobe(), ctx())

    const unchanged = (o: typeof before) => o.garments.filter((g) => g.category !== 'Shoes').map((g) => g.id)
    expect(unchanged(after)).toEqual(unchanged(before))
    expect(after.garments.find((g) => g.category === 'Shoes')!.id).not.toBe(shoes.id)
  })

  it('keeps the piece in its original position, so the outfit does not reshuffle', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    const index = before.garments.findIndex((g) => g.id === shoes.id)
    const after = swapPiece(before, shoes.id, wardrobe(), ctx())
    expect(after.garments[index].category).toBe('Shoes')
  })

  it('recomputes the id, so a swapped outfit is a different outfit', () => {
    // verdicts is keyed by id — wearing one combination must not mark another.
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    const after = swapPiece(before, shoes.id, wardrobe(), ctx())
    expect(after.id).not.toBe(before.id)
  })

  it('keeps the same slot, so the card does not remount', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    expect(swapPiece(before, shoes.id, wardrobe(), ctx()).slot).toBe(before.slot)
  })

  it('recomputes the reason to match the new outfit', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    const after = swapPiece(before, shoes.id, wardrobe(), ctx())
    expect(after.why.length).toBeGreaterThan(0)
    expect(after.why.endsWith('.')).toBe(true)
  })

  it('cycles back to the original, so a swap is always undoable', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    // Two pairs of shoes in the fixture wardrobe, so two taps come full circle.
    const once = swapPiece(before, shoes.id, wardrobe(), ctx())
    const twice = swapPiece(once, once.garments.find((g) => g.category === 'Shoes')!.id, wardrobe(), ctx())
    expect(twice.garments.map((g) => g.id)).toEqual(before.garments.map((g) => g.id))
    expect(twice.id).toBe(before.id)
  })

  it('is a no-op when there is nothing to swap to', () => {
    // One pair of shoes in the whole wardrobe — tapping swap must not blank it
    // out or throw; it simply does nothing.
    const thin = [
      g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' }),
      g('only-shoes', { category: 'Shoes' }),
    ]
    const [outfit] = recommend(thin, ctx())
    const shoes = outfit.garments.find((x) => x.category === 'Shoes')!
    expect(swapPiece(outfit, shoes.id, thin, ctx())).toBe(outfit)
  })

  it('is a no-op for a garment that is not in the outfit', () => {
    const outfit = build()
    expect(swapPiece(outfit, 'not-a-real-id', wardrobe(), ctx())).toBe(outfit)
  })

  it('is deterministic — the same swap twice gives the same result', () => {
    const before = build()
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    const a = swapPiece(before, shoes.id, wardrobe(), ctx())
    const b = swapPiece(before, shoes.id, wardrobe(), ctx())
    expect(a.garments.map((g) => g.id)).toEqual(b.garments.map((g) => g.id))
    expect(a.score).toBe(b.score)
  })

  it('does not mutate the outfit it was given', () => {
    const before = build()
    const snapshot = before.garments.map((g) => g.id)
    const shoes = before.garments.find((g) => g.category === 'Shoes')!
    swapPiece(before, shoes.id, wardrobe(), ctx())
    expect(before.garments.map((g) => g.id)).toEqual(snapshot)
  })
})

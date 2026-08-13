import { describe, it, expect } from 'vitest'
import {
  recommend, scoreGarment, targetWarmth, isWet, daysSince, explain,
  alternativesFor, swapPiece, shuffle, weatherKey, outfitKey,
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

  it('keeps nudging away for the rest of the week, not just three days', () => {
    // A three-day window meant Monday's shirt was back in the running on
    // Thursday, and the same handful of clothes circled all week.
    const worn = scoreGarment(g('a', { lastWorn: '2026-08-01' }), ctx()).total
    expect(worn).toBeLessThan(scoreGarment(g('a', { lastWorn: null }), ctx()).total)
  })

  it('treats a lastWorn in the future as worn today rather than as a bonus', () => {
    // A clock change or a hand-edited Notion row can produce one; a negative
    // day count used to fall through every branch untouched.
    expect(scoreGarment(g('a', { lastWorn: '2026-09-01' }), ctx()).total)
      .toBeLessThan(scoreGarment(g('a', { lastWorn: null }), ctx()).total)
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

describe('recommend — the order the cards come in', () => {
  it('leads with the best outfit, not merely the longest', () => {
    // Regression: an earlier sort ranked purely on garment count, so a
    // four-piece outfit led over a three-piece one scoring far better.
    const outfits = recommend(wardrobe(), ctx({ temp: 3 }))
    const scores = outfits.map((o) => o.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('puts a shoeless outfit last, however well it scores', () => {
    const outfits = recommend(wardrobe(), ctx())
    const shoeless = outfits.findIndex((o) => !o.garments.some((x) => x.category === 'Shoes'))
    if (shoeless !== -1) expect(shoeless).toBe(outfits.length - 1)
  })

  it('numbers the slots 0, 1, 2 in the order shown', () => {
    expect(recommend(wardrobe(), ctx()).map((o) => o.slot)).toEqual([0, 1, 2])
  })
})

describe('recommend — accessories', () => {
  const withExtras = (): Garment[] => [
    ...wardrobe(),
    g('scarf', { category: 'Accessory', warmth: 'Warm', styles: ['cosy', 'layering'] }),
    g('tote', { category: 'Accessory', warmth: 'Light', styles: ['casual', 'school'] }),
  ]

  it('reaches for something warm when it is genuinely cold', () => {
    const outfits = recommend(withExtras(), ctx({ temp: 1 }))
    expect(outfits[0].garments.map((x) => x.id)).toContain('scarf')
  })

  it('leaves accessories alone on an ordinary day with no mood', () => {
    // A scarf in February is part of the outfit. A tote on a Tuesday is just a
    // tote, and stapling one to every suggestion is clutter, not styling.
    for (const outfit of recommend(withExtras(), ctx({ temp: 18 }))) {
      expect(outfit.garments.some((x) => x.category === 'Accessory')).toBe(false)
    }
  })

  it('brings one along when it matches a mood she picked', () => {
    const outfits = recommend(withExtras(), ctx({ temp: 18, mood: 'Low-key' }))
    expect(outfits.some((o) => o.garments.some((x) => x.category === 'Accessory'))).toBe(true)
  })

  it('wears the only suitable accessory once, not on every card', () => {
    // Unlike shoes: repeating the only pair beats going barefoot, but an
    // outfit with no accessory is already a complete outfit, so three cards
    // wearing the same scarf just look copy-pasted.
    const oneScarf = [
      ...wardrobe(),
      g('scarf', { category: 'Accessory', warmth: 'Warm', styles: ['cosy'] }),
    ]
    const wearing = recommend(oneScarf, ctx({ temp: 1 }))
      .filter((o) => o.garments.some((x) => x.id === 'scarf'))
    expect(wearing).toHaveLength(1)
  })

  it('never wears two accessories at once', () => {
    for (const outfit of recommend(withExtras(), ctx({ temp: 0 }))) {
      const worn = outfit.garments.filter((x) => x.category === 'Accessory')
      expect(worn.length).toBeLessThanOrEqual(1)
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

describe('the daily shuffle', () => {
  it('stays under 1, so it can only ever break a tie', () => {
    // The property the whole design rests on: every other rule scores in whole
    // numbers, so an offset smaller than 1 reorders garments the scorer thinks
    // are equal and can never overrule one it doesn't.
    for (const id of ['a', 'b', 'jeans', 'demo_g_white_tee', '', '🧥']) {
      for (const day of ['2026-01-01', '2026-08-06', '2026-12-31']) {
        const value = shuffle(id, ctx({ today: day }))
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    }
  })

  it('is stable for the same garment on the same day', () => {
    expect(shuffle('jeans', ctx())).toBe(shuffle('jeans', ctx()))
  })

  it('moves the tie-break from one day to the next', () => {
    const days = ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10']
    const values = days.map((today) => shuffle('jeans', ctx({ today })))
    expect(new Set(values).size).toBeGreaterThan(1)
  })

  it('still cannot beat the weather', () => {
    // A Light garment on a freezing day loses by 7 whole points; no tie-break
    // is allowed to rescue it, whatever the date.
    for (let day = 1; day <= 28; day++) {
      const today = `2026-02-${String(day).padStart(2, '0')}`
      const light = scoreGarment(g('a', { warmth: 'Light' }), ctx({ temp: 0, today })).total
      const warm = scoreGarment(g('b', { warmth: 'Warm' }), ctx({ temp: 0, today })).total
      expect(light).toBeLessThan(warm)
    }
  })

  it('gives a different set of outfits on a different day', () => {
    // Nora's actual complaint. Same wardrobe, same weather, same mood — the
    // suggestions should not be word-for-word identical all week.
    const monday = recommend(wardrobe(), ctx({ today: '2026-08-10' })).map((o) => o.id)
    const week = ['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']
      .map((today) => recommend(wardrobe(), ctx({ today })).map((o) => o.id).join(','))
    expect(week.some((day) => day !== monday.join(','))).toBe(true)
  })

  it('gives a different set when variety is bumped', () => {
    const first = recommend(wardrobe(), ctx()).map((o) => o.id).join(',')
    const bumped = [1, 2, 3].map((variety) =>
      recommend(wardrobe(), ctx({ variety })).map((o) => o.id).join(','))
    expect(bumped.some((set) => set !== first)).toBe(true)
  })
})

describe('recommend — not offering what today already answered', () => {
  it('skips a combination already worn or skipped today', () => {
    const first = recommend(wardrobe(), ctx())
    const again = recommend(wardrobe(), ctx({ avoidIds: [first[0].id] }))
    expect(again.map((o) => o.id)).not.toContain(first[0].id)
  })

  it('still fills three cards after one is ruled out', () => {
    const first = recommend(wardrobe(), ctx())
    expect(recommend(wardrobe(), ctx({ avoidIds: [first[0].id] }))).toHaveLength(3)
  })

  it('repeats itself rather than showing nothing at all', () => {
    // One outfit is all this wardrobe can make. Having answered it, she should
    // still see it rather than an empty screen claiming she owns nothing —
    // the same call this file makes about a single pair of shoes.
    const thin = [g('tee', { category: 'Top' }), g('jeans', { category: 'Bottom' })]
    const [only] = recommend(thin, ctx())
    const after = recommend(thin, ctx({ avoidIds: [only.id] }))
    expect(after.map((o) => o.id)).toEqual([only.id])
  })

  it('matches the key a history row would produce', () => {
    // History stores garmentIds in whatever order the outfit was built; the
    // suggestion sorts them. Both sides must land on the same string or
    // "already worn today" silently never matches.
    const [outfit] = recommend(wardrobe(), ctx())
    const asStored = [...outfit.garments.map((x) => x.id)].reverse()
    expect(outfitKey(asStored)).toBe(outfit.id)
  })
})

describe('weatherKey', () => {
  it('ignores a change too small to alter a suggestion', () => {
    expect(weatherKey(ctx({ temp: 20.1 }))).toBe(weatherKey(ctx({ temp: 20.3 })))
  })

  it('changes when a threshold is actually crossed', () => {
    expect(weatherKey(ctx({ temp: 21.9 }))).not.toBe(weatherKey(ctx({ temp: 22.1 })))
    expect(weatherKey(ctx({ wind: 34 }))).not.toBe(weatherKey(ctx({ wind: 36 })))
    expect(weatherKey(ctx({ condition: 'clear' }))).not.toBe(weatherKey(ctx({ condition: 'rain' })))
  })

  it('has a value when there is no temperature at all', () => {
    expect(weatherKey(ctx({ temp: null })).length).toBeGreaterThan(0)
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

  it('falls back to a dress when there is nothing to wear with the tops', () => {
    // Regression: a top with no bottom used to `break` the whole loop, so a
    // wardrobe of dresses plus one lonely top returned NOTHING whenever the
    // top happened to outscore the dresses.
    const outfits = recommend([
      g('tee', { category: 'Top', warmth: 'Mid', favourite: true }),
      g('frock', { category: 'Dress', warmth: 'Light' }),
    ], ctx())
    expect(outfits).toHaveLength(1)
    expect(outfits[0].garments.map((x) => x.id)).toEqual(['frock'])
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

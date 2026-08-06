import { describe, it, expect } from 'vitest'
import { parseTagResponse, EMPTY_TAGS } from './tagging.ts'
import { CATEGORIES, COLOURS, STYLES, WARMTHS } from './vocabulary.ts'

const good = JSON.stringify({
  name: 'Blue denim jacket',
  category: 'Outerwear',
  colours: ['denim', 'blue'],
  warmth: 'Mid',
  styles: ['casual', 'layering'],
})

describe('parseTagResponse — the happy path', () => {
  it('reads a clean JSON answer', () => {
    expect(parseTagResponse(good)).toEqual({
      name: 'Blue denim jacket',
      category: 'Outerwear',
      colours: ['denim', 'blue'],
      warmth: 'Mid',
      styles: ['casual', 'layering'],
    })
  })
})

describe('parseTagResponse — forgiving about shape', () => {
  it('digs JSON out of a code fence', () => {
    expect(parseTagResponse('```json\n' + good + '\n```').category).toBe('Outerwear')
  })

  it('digs JSON out of surrounding prose', () => {
    expect(parseTagResponse(`Sure! Here you go:\n${good}\nHope that helps.`).category).toBe('Outerwear')
  })

  it('is not fooled by a brace in trailing prose', () => {
    // A naive lastIndexOf('}') would swallow the trailing sentence and fail.
    expect(parseTagResponse(`${good}\nUse {these} as you like.`).name).toBe('Blue denim jacket')
  })

  it('ignores braces inside string values', () => {
    const tricky = '{"name": "Jacket {the good one}", "category": "Outerwear"}'
    expect(parseTagResponse(tricky).category).toBe('Outerwear')
  })

  it('accepts a comma-separated string where a list was asked for', () => {
    const loose = '{"category": "Top", "colours": "navy, cream", "styles": "casual"}'
    const tags = parseTagResponse(loose)
    expect(tags.colours).toEqual(['navy', 'cream'])
    expect(tags.styles).toEqual(['casual'])
  })

  it('rescues casing variants', () => {
    const cased = '{"category": "outerwear", "warmth": "mid", "styles": ["Casual"]}'
    const tags = parseTagResponse(cased)
    expect(tags.category).toBe('Outerwear')
    expect(tags.warmth).toBe('Mid')
    expect(tags.styles).toEqual(['casual'])
  })

  it('tidies a messy name', () => {
    expect(parseTagResponse('{"name": "  Blue   denim\\n jacket "}').name).toBe('Blue denim jacket')
  })

  it('caps an essay of a name — it renders under a 106px tile', () => {
    const long = JSON.stringify({ name: 'A '.repeat(200) })
    expect((parseTagResponse(long).name ?? '').length).toBeLessThanOrEqual(60)
  })
})

describe('parseTagResponse — strict about values', () => {
  it('drops an invented colour but keeps the valid ones', () => {
    const tags = parseTagResponse('{"colours": ["navy", "dusty rose", "cream"]}')
    expect(tags.colours).toEqual(['navy', 'cream'])
  })

  it('leaves an invented category unset rather than guessing', () => {
    // Untagged is visible and fixable; confidently wrong is neither.
    expect(parseTagResponse('{"category": "Blouse"}').category).toBe(null)
  })

  it('never emits a value Notion has not registered', () => {
    // The guarantee. An unregistered option makes Notion reject the WHOLE
    // property patch, silently failing unrelated fields with it.
    const hostile = JSON.stringify({
      name: 'x',
      category: 'Cardigan',
      colours: ['dusty rose', 'ecru', 'navy', 42, null, { name: 'blue' }],
      warmth: 'Toasty',
      styles: ['cottagecore', 'casual', ''],
    })
    const tags = parseTagResponse(hostile)
    expect(tags.category === null || (CATEGORIES as readonly string[]).includes(tags.category)).toBe(true)
    expect(tags.warmth === null || (WARMTHS as readonly string[]).includes(tags.warmth)).toBe(true)
    for (const c of tags.colours) expect(COLOURS as readonly string[]).toContain(c)
    for (const s of tags.styles) expect(STYLES as readonly string[]).toContain(s)
    expect(tags.colours).toEqual(['navy'])
    expect(tags.styles).toEqual(['casual'])
  })
})

describe('parseTagResponse — never throws', () => {
  const junk = [
    '', '   ', 'I cannot help with that.', 'null', '[]', '[1,2,3]',
    '{', '{"category":', '{"category": "Top"', 'undefined',
    '{"colours": null}', '{"colours": {"a": 1}}', '{"name": 42}',
  ]

  it.each(junk)('survives %j', (input) => {
    expect(() => parseTagResponse(input)).not.toThrow()
    const tags = parseTagResponse(input)
    expect(Array.isArray(tags.colours)).toBe(true)
    expect(Array.isArray(tags.styles)).toBe(true)
  })

  it('returns empty tags when there is no JSON at all', () => {
    expect(parseTagResponse('I cannot tell what this is.')).toEqual(EMPTY_TAGS)
  })

  it('returns empty tags for a JSON array rather than an object', () => {
    expect(parseTagResponse('["Top"]')).toEqual(EMPTY_TAGS)
  })

  it('does not share mutable state between empty results', () => {
    // EMPTY_TAGS is a module-level constant; handing out the same arrays would
    // let one caller's edit leak into the next.
    const a = parseTagResponse('nope')
    a.colours.push('navy')
    expect(parseTagResponse('nope').colours).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { EMPTY_SETTINGS, type Settings } from './settings'
import {
  buildCreateOdysseyProperties,
  buildDraftOdysseyProperties,
  canActivate,
  charterErrors,
  computeDayIndex,
  computeEndDate,
  defaultStartDate,
  emptyDraft,
  firstIncompleteStep,
  isSpecific,
  nextOdysseyNumber,
  odysseyName,
  parseDraftToCharter,
  type CharterDraft,
} from './charter'

/** A fully-valid draft for assertions. */
function validDraft(over: Partial<CharterDraft> = {}): CharterDraft {
  return {
    behaviour: 'Move my body before the day takes me',
    outcomePicture: 'A steadier mind and my mornings back',
    identity: 'I am someone who starts the day in motion',
    tinyVersion: 'Put on shoes and walk to the corner',
    anchor: 'After I pour my first coffee',
    ifThen: 'If it rains, I walk the hallway',
    pairing: '',
    dailySuccess: 'Shoes on, outside, once',
    whyValue: 'A body in motion makes a steadier mind',
    startDate: '2026-07-06',
    confirmedShrink: true,
    ...over,
  }
}

describe('isSpecific', () => {
  it('rejects one-word or too-short values, accepts concrete phrases', () => {
    expect(isSpecific('walk')).toBe(false)
    expect(isSpecific('go')).toBe(false)
    expect(isSpecific('walk to the corner')).toBe(true)
  })
})

describe('charterErrors / canActivate', () => {
  it('flags every empty required field', () => {
    const errors = charterErrors(emptyDraft(new Date('2026-07-01')))
    expect(errors.behaviour).toBeTruthy()
    expect(errors.whyValue).toBeTruthy()
    // pairing is optional
    expect(errors.pairing).toBeUndefined()
  })

  it('flags a vague tiny version / anchor', () => {
    const errors = charterErrors(validDraft({ tinyVersion: 'walk', anchor: 'coffee' }))
    expect(errors.tinyVersion).toBeTruthy()
    expect(errors.anchor).toBeTruthy()
  })

  it('a complete, specific draft has no errors', () => {
    expect(charterErrors(validDraft())).toEqual({})
  })

  it('canActivate requires both validity and the shrink affirmation', () => {
    expect(canActivate(validDraft())).toBe(true)
    expect(canActivate(validDraft({ confirmedShrink: false }))).toBe(false)
    expect(canActivate(validDraft({ behaviour: '' }))).toBe(false)
  })
})

describe('firstIncompleteStep', () => {
  // The wizard's field order.
  const keys: (keyof ReturnType<typeof validDraft>)[] = [
    'behaviour', 'outcomePicture', 'identity', 'tinyVersion', 'anchor',
    'ifThen', 'pairing', 'dailySuccess', 'whyValue', 'startDate',
  ]

  it('returns the review step (length) for a complete draft', () => {
    expect(firstIncompleteStep(validDraft(), keys)).toBe(keys.length)
  })

  it('lands on the first empty required field', () => {
    expect(firstIncompleteStep(validDraft({ behaviour: '' }), keys)).toBe(0)
    expect(firstIncompleteStep(validDraft({ identity: '' }), keys)).toBe(2)
    expect(firstIncompleteStep(validDraft({ behaviour: '', identity: '' }), keys)).toBe(0) // earliest wins
  })

  it('skips an empty optional field (pairing) — it never traps resume', () => {
    expect(firstIncompleteStep(validDraft({ pairing: '' }), keys)).toBe(keys.length)
  })
})

describe('dates', () => {
  it('defaultStartDate returns the next Monday (or today if Monday)', () => {
    expect(defaultStartDate(new Date('2026-07-06T10:00:00'))).toBe('2026-07-06') // Mon → same day
    expect(defaultStartDate(new Date('2026-07-07T10:00:00'))).toBe('2026-07-13') // Tue → next Mon
    expect(defaultStartDate(new Date('2026-07-05T10:00:00'))).toBe('2026-07-06') // Sun → next Mon
  })

  it('computeEndDate is start + 41 days (42-day inclusive)', () => {
    expect(computeEndDate('2026-07-06')).toBe('2026-08-16')
  })

  it('computeDayIndex is 1-based from the start date', () => {
    expect(computeDayIndex('2026-07-06', new Date('2026-07-06T12:00:00'))).toBe(1)
    expect(computeDayIndex('2026-07-06', new Date('2026-07-12T12:00:00'))).toBe(7)
    expect(computeDayIndex('2026-07-06', new Date('2026-07-05T12:00:00'))).toBe(0)
  })
})

describe('numbering & naming', () => {
  it('nextOdysseyNumber starts at 1 and increments', () => {
    expect(nextOdysseyNumber(null)).toBe(1)
    expect(nextOdysseyNumber(0)).toBe(1)
    expect(nextOdysseyNumber(3)).toBe(4)
  })

  it('odysseyName combines the Latin number + behaviour tail', () => {
    expect(odysseyName(1, 'morning movement')).toBe('Odyssey 1 — morning movement')
    expect(odysseyName(2, '   ')).toBe('Odyssey 2')
  })
})

describe('buildCreateOdysseyProperties', () => {
  const settings: Settings = {
    ...EMPTY_SETTINGS,
    buddyName: 'Sam',
    buddyEmail: 'sam@example.com',
    dailyTime: '07:30',
    weeklySlot: 'Sun 18:00',
  }

  it('maps fields to the correct Notion property shapes', () => {
    const props = buildCreateOdysseyProperties(validDraft(), settings, 1) as Record<string, any>
    expect(props['Name'].title[0].text.content).toBe('Odyssey 1 — Move my body before the day takes me')
    expect(props['Odyssey Number'].number).toBe(1)
    expect(props['Status'].select.name).toBe('Active')
    expect(props['Start Date'].date.start).toBe('2026-07-06')
    expect(props['End Date'].date.start).toBe('2026-08-16')
    expect(props['Tiny Version'].rich_text[0].text.content).toBe('Put on shoes and walk to the corner')
    expect(props['Buddy Name'].rich_text[0].text.content).toBe('Sam')
    expect(props['Buddy Channel'].rich_text[0].text.content).toBe('sam@example.com')
  })

  it('renders an empty optional field as an empty rich_text array', () => {
    const props = buildCreateOdysseyProperties(validDraft({ pairing: '' }), settings, 1) as Record<string, any>
    expect(props['Pairing'].rich_text).toEqual([])
  })
})

describe('buildDraftOdysseyProperties (Planning)', () => {
  const settings: Settings = { ...EMPTY_SETTINGS, buddyName: 'Sam', buddyEmail: 'sam@example.com' }

  it('sets Status=Planning, carries NO Odyssey Number, and writes dates from the start date', () => {
    const props = buildDraftOdysseyProperties(validDraft(), settings) as Record<string, any>
    expect(props['Status'].select.name).toBe('Planning')
    expect(props['Odyssey Number']).toBeUndefined()
    expect(props['Start Date'].date.start).toBe('2026-07-06')
    expect(props['End Date'].date.start).toBe('2026-08-16')
    expect(props['Tiny Version'].rich_text[0].text.content).toBe('Put on shoes and walk to the corner')
    expect(props['Buddy Name'].rich_text[0].text.content).toBe('Sam')
  })

  it('titles from the behaviour tail, falling back when blank', () => {
    expect((buildDraftOdysseyProperties(validDraft({ behaviour: 'morning movement' }), settings) as any)['Name'].title[0].text.content).toBe('morning movement')
    expect((buildDraftOdysseyProperties(validDraft({ behaviour: '' }), settings) as any)['Name'].title[0].text.content).toBe('Planned Odyssey')
  })

  it('omits the dates entirely when no start date is set (partial draft)', () => {
    const props = buildDraftOdysseyProperties(validDraft({ startDate: '' }), settings) as Record<string, any>
    expect(props['Start Date']).toBeUndefined()
    expect(props['End Date']).toBeUndefined()
  })
})

describe('parseDraftToCharter', () => {
  it('maps a Planning row back into a draft and resets the shrink gate', () => {
    const detail = {
      behaviour: 'morning movement',
      outcomePicture: 'steadier mind',
      identity: 'I am someone who moves',
      tinyVersion: 'walk to the corner',
      anchor: 'after my first coffee',
      ifThen: 'if it rains, hallway',
      pairing: '',
      dailySuccess: 'shoes on, outside',
      whyValue: 'a body in motion',
      startDate: '2026-07-06',
    }
    expect(parseDraftToCharter(detail)).toEqual({ ...detail, confirmedShrink: false })
  })

  it('falls back to the default start date when the row has none', () => {
    const detail = {
      behaviour: '', outcomePicture: '', identity: '', tinyVersion: '', anchor: '',
      ifThen: '', pairing: '', dailySuccess: '', whyValue: '', startDate: '',
    }
    expect(parseDraftToCharter(detail, new Date('2026-07-07T10:00:00')).startDate).toBe('2026-07-13')
  })
})

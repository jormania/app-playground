import { describe, it, expect } from 'vitest'
import { weekAdjusted, validateThemes, enforceVariety, validateCompanion, validateConcert } from './validate.js'

describe('weekAdjusted — this week, differently', () => {
  const prefs = { timePerWeek: 'generous', breadth: 3, familiarity: 3, pairs: false }

  it('moves each preference one step for the week, and leaves the rest', () => {
    expect(weekAdjusted(prefs, ['shorter'])).toMatchObject({ timePerWeek: 'standard', breadth: 3, familiarity: 3 })
    expect(weekAdjusted(prefs, ['wider', 'familiar'])).toMatchObject({ timePerWeek: 'generous', breadth: 4, familiarity: 2 })
    expect(weekAdjusted(prefs, ['quieter'])).toEqual(prefs)
  })

  it('stops at the ends of each scale', () => {
    expect(weekAdjusted({ timePerWeek: 'short', breadth: 5, familiarity: 1 }, ['shorter', 'wider', 'familiar'])).toMatchObject({ timePerWeek: 'short', breadth: 5, familiarity: 1 })
    expect(weekAdjusted(prefs, undefined)).toEqual(prefs)
  })
})


describe('shapes of a week', () => {
  const option = (mood, form) => ({ mood, title: `${mood} t`, pitch: 'p', character: [], why: '', angle: '', returningThemeId: '', continuityNote: '', form })

  it('keeps each direction’s form, and turns "many ways" into a plain theme without pairs', () => {
    const out = { options: [option('immersive', 'dialogue'), option('curious', 'many-ways'), option('adventurous', 'nonsense')] }
    expect(validateThemes(out, { threadIds: [], pairs: true }).value.options.map((o) => o.form)).toEqual(['dialogue', 'many-ways', 'theme'])
    expect(validateThemes(out, { threadIds: [], pairs: false }).value.options.map((o) => o.form)).toEqual(['dialogue', 'theme', 'theme'])
  })

  it('lets two composers in dialogue have more than two works each', () => {
    const it = (composer, workTitle) => ({ composer, workTitle, soloists: [] })
    const value = { sections: [{ role: 'start', heading: 'H', items: [it('Debussy', 'La mer'), it('Debussy', 'Jeux'), it('Debussy', 'Nocturnes'), it('Ravel', 'Daphnis'), it('Ravel', 'La valse'), it('Ravel', 'Boléro')] }] }
    const count = (v) => v.sections.reduce((n, s) => n + s.items.length, 0)
    expect(count(enforceVariety(value, { breadth: 3, timePerWeek: 'generous' }))).toBe(4)
    expect(count(enforceVariety(value, { breadth: 3, timePerWeek: 'generous' }, { form: 'dialogue' }))).toBe(6)
  })
})


describe('the listening companion', () => {
  it('keeps one note per track, in track order, and flags a work left out', () => {
    const works = [{ key: 'r1', tracks: ['I', 'II', 'III'] }, { key: 'r2', tracks: ['Tapiola'] }]
    const out = { works: [{ key: 'r1', movements: ['one', 'two', 'three', 'four'] }] }
    const { value, problems } = validateCompanion(out, { works })
    expect(value.works).toEqual([{ key: 'r1', movements: ['one', 'two', 'three'] }])
    expect(problems).toEqual(['No notes for "r2".'])
    expect(validateCompanion({ works: [{ key: 'r2', movements: [] }, { key: 'r1', movements: ['a'] }] }, { works }).value.works).toEqual([{ key: 'r1', movements: ['a', '', ''] }])
  })
})

describe('a concert read from a screenshot', () => {
  it('keeps what was read, drops a date that isn’t one, and needs a work', () => {
    const { value, problems } = validateConcert({
      venue: ' Filarmonica George Enescu ', hall: '', date: '16 oct', time: '19:00', orchestra: 'Orchestra Filarmonicii', conductor: '',
      soloists: [{ name: 'Andrei Ioniță', instrument: 'cello' }],
      works: [{ composer: 'Johannes Brahms', title: 'Double Concerto in A minor', catalogue: 'Op. 102' }, { composer: '', title: 'Encore', catalogue: '' }],
    })
    expect(value).toMatchObject({ venue: 'Filarmonica George Enescu', date: '', time: '19:00', conductor: undefined, works: [{ composer: 'Johannes Brahms', title: 'Double Concerto in A minor', catalogue: 'Op. 102' }] })
    expect(problems).toEqual([])
    expect(validateConcert({ works: [] }).problems).toEqual(['No works could be read.'])
  })
})

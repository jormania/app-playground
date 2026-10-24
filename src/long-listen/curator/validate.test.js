import { describe, it, expect } from 'vitest'
import { weekAdjusted, validateThemes, enforceVariety, validateCompanion, validateConcert, needsSoloists, needsVoices, validateSeason, validateProgramme, validateTags, validateTaste, validateSketch } from './validate.js'

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
    // A reply a note short stays short, never padded: padded, a note left out in the middle would put every
    // later one under the wrong movement and hide the gap from the journey's re-ask (a stabilisation finding).
    expect(validateCompanion({ works: [{ key: 'r2', movements: [] }, { key: 'r1', movements: ['a'] }] }, { works }).value.works).toEqual([{ key: 'r1', movements: ['a'] }])
    expect(validateCompanion({ works: [{ key: 'r1', movements: ['on I', 'on III'] }, { key: 'r2', movements: ['x'] }] }, { works }).value.works[0].movements).toHaveLength(2)
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

describe('works with a soloist', () => {
  it('knows a concerto, a concertante and a work for soloist and orchestra', () => {
    expect(needsSoloists('Cello Concerto in E minor')).toBe(true)
    expect(needsSoloists('Double Concerto in A minor')).toBe(true)
    expect(needsSoloists('Sinfonia concertante in E-flat')).toBe(true)
    expect(needsSoloists('Schelomo, Hebraic Rhapsody for cello and orchestra')).toBe(true)
    expect(needsSoloists('Tzigane', 'concerto')).toBe(true)
  })
  it('leaves alone the works that have none to name', () => {
    expect(needsSoloists('Concerto for Orchestra')).toBe(false)
    expect(needsSoloists('Concerto grosso in D, Op. 6 No. 4')).toBe(false)
    expect(needsSoloists('Symphony No. 5')).toBe(false)
    expect(needsSoloists('Tapiola')).toBe(false)
  })
})

describe('validateSeason', () => {
  const met = [{ composer: 'Claude Debussy', work: 'La mer' }]
  it('keeps only works actually met among those worth hearing again', () => {
    const again = [
      { composer: 'Claude Debussy', work: 'La Mer', why: 'a' },
      { composer: 'Maurice Ravel', work: 'Boléro', why: 'never offered' },
    ]
    const r = validateSeason({ title: 'T', opening: 'O', threads: [], again }, { met })
    expect(r.problems).toEqual([])
    expect(r.value.again.map((a) => a.work)).toEqual(['La Mer'])
  })
  it('needs a title and an opening', () => {
    expect(validateSeason({}, { met }).problems).toHaveLength(2)
  })
})

describe('validateConcert — soloists per work', () => {
  it('keeps, for each work, only names on the programme’s own list', () => {
    const r = validateConcert({
      venue: 'Ateneul Român', date: '2026-10-08', soloists: [{ name: 'Andrei Ioniță', instrument: 'cello' }, { name: 'Alexandra Conunova', instrument: 'violin' }],
      works: [
        { composer: 'Johannes Brahms', title: 'Double Concerto', soloists: ['Alexandra Conunova', 'andrei ionita', 'Someone Else'] },
        { composer: 'Anatol Vieru', title: 'Cello Concerto', soloists: ['Andrei Ioniță'] },
        { composer: 'Felix Mendelssohn', title: 'Symphony No. 3', soloists: [] },
      ],
    })
    expect(r.value.works.map((w) => w.soloists)).toEqual([['Alexandra Conunova', 'Andrei Ioniță'], ['Andrei Ioniță'], []])
  })
})

describe('the listener’s switches for voices and concertos (a stabilisation finding)', () => {
  const item = (composer, workTitle) => ({ composer, workTitle, conductor: 'A Conductor', orchestra: 'An Orchestra', soloists: [{ name: 'A Soloist', instrument: 'violin' }], character: ['clear'], why: 'w', whyThisRecording: 'r', listenFor: [] })
  const prog = (...items) => ({ title: 't', dek: 'd', introduction: 'i', sections: [{ role: 'start', heading: 'Start here', items }], comparisons: [] })
  const concerto = item('Max Bruch', 'Violin Concerto No. 1')
  const choral = item('Ludwig van Beethoven', 'Symphony No. 9 "Choral"')
  const plain = item('Claude Debussy', 'La mer')

  it('sends a programme back for a concerto when concertos are off, and for a choral work when voices are off', () => {
    expect(validateProgramme(prog(plain, concerto), { preferences: { includeConcertos: false } }).problems.join(' ')).toMatch(/Violin Concerto No\. 1.*concertos switched off/)
    expect(validateProgramme(prog(plain, choral), { preferences: { includeVoices: false } }).problems.join(' ')).toMatch(/Choral.*voices switched off/)
  })

  it('says nothing when the switches are on (the default), or when the work is neither', () => {
    const on = { includeConcertos: true, includeVoices: true }
    expect(validateProgramme(prog(plain, concerto, choral), { preferences: on }).problems.filter((x) => /switched off/.test(x))).toEqual([])
    expect(validateProgramme(prog(plain), { preferences: { includeConcertos: false, includeVoices: false } }).problems.filter((x) => /switched off/.test(x))).toEqual([])
  })

  it('knows voices by the title: sure cases only', () => {
    for (const t of ['Requiem', 'Mass in B minor', 'Symphony No. 2 "Resurrection"', 'Four Last Songs', 'Das Lied von der Erde', 'Carmina Burana', 'Stabat Mater']) expect(needsVoices(t), t).toBe(true)
    for (const t of ['La mer', 'Symphony No. 5', 'Concerto for Orchestra', 'The Planets', 'Piano Sonata No. 14 "Moonlight"']) expect(needsVoices(t), t).toBe(false)
  })
})

describe('the listener’s choice of recording era (Settings → Recordings)', () => {
  const item = (work, year) => ({ composer: 'Claude Debussy', workTitle: work, conductor: 'A Conductor', orchestra: 'An Orchestra', soloists: [], year, character: ['clear'], why: 'w', whyThisRecording: 'r', listenFor: [] })
  const prog = (...items) => ({ title: 't', dek: 'd', introduction: 'i', sections: [{ role: 'start', heading: 'Start here', items }], comparisons: [] })
  const era = (p, recordingEra) => validateProgramme(p, { preferences: { recordingEra } }).problems.filter((x) => /before 1970/.test(x))

  it('sends back a Modern week whose stated years are mostly old, and says why', () => {
    const old = prog(item('La mer', '1957'), item('Nocturnes', '1963'), item('Images', '1994'))
    expect(era(old, 'modern-sound').join(' ')).toMatch(/2 of 3 with a known year.*from about 1980 on/)
  })

  it('lets a Modern week keep the odd historic one, ignores years it isn’t told, and asks nothing of the other eras', () => {
    expect(era(prog(item('La mer', '1957'), item('Nocturnes', '1994'), item('Images', '2008')), 'modern-sound')).toEqual([])
    expect(era(prog(item('La mer', ''), item('Nocturnes', undefined)), 'modern-sound')).toEqual([])
    const old = prog(item('La mer', '1957'), item('Nocturnes', '1963'))
    for (const e of ['any', 'historic-welcome', 'period-practice']) expect(era(old, e), e).toEqual([])
  })
})

describe('listen for, tied to its movement', () => {
  const item = (listenFor, listenForMovement) => ({ composer: 'Claude Debussy', workTitle: 'La mer', conductor: 'Pierre Boulez', orchestra: 'The Cleveland Orchestra', soloists: [], character: ['clear'], why: 'w', whyThisRecording: 'r', listenFor, listenForMovement })
  const out = (i) => ({ title: 't', dek: 'd', introduction: 'i', sections: [{ role: 'start', heading: 'Start here', items: [i] }], comparisons: [] })
  it('keeps one tag per point — a numeral, or "" for the whole work', () => {
    const v = validateProgramme(out(item(['a', 'b', 'c'], ['i', 'II.', 'the finale']))).value
    expect(v.sections[0].items[0].listenForMovement).toEqual(['I', 'II', ''])
  })
  it('reads a missing or short list as the whole work', () => {
    const v = validateProgramme(out(item(['a', 'b'], undefined))).value
    expect(v.sections[0].items[0].listenForMovement).toEqual(['', ''])
  })
})

describe('tags for a programme written before', () => {
  it('keeps one clean tag per point, and reads a work left out as untagged', () => {
    const v = validateTags({ works: [{ key: 'w1', movements: ['ii', 'the finale'] }] }, { works: [{ key: 'w1', count: 3 }, { key: 'w2', count: 2 }] })
    expect(v.value.works).toEqual([{ key: 'w1', movements: ['II', '', ''] }, { key: 'w2', movements: ['', ''] }])
    expect(v.problems).toEqual([])
  })
})

describe('release four validators', () => {
  it('keeps a definition, a portrait with its years, and a preparation read like a concert', async () => {
    const { validateDefine, validatePortrait, validatePrepare } = await import('./validate.js')
    expect(validateDefine({ definition: ' A ground. ' })).toEqual({ value: { definition: 'A ground.' }, problems: [] })
    expect(validateDefine({}).problems).toHaveLength(1)
    expect(validatePortrait({ lifespan: 'unknown', portrait: 'P.' }).value).toEqual({ lifespan: undefined, portrait: 'P.' })
    const { value, problems } = validatePrepare({
      intro: 'Evening.', inTheHall: '', orchestra: 'ORS', conductor: '', soloists: [{ name: 'Andrei Ioniță', instrument: 'cello' }],
      works: [
        { composer: 'Dvořák', title: 'Cello Concerto', catalogue: 'Op. 104', soloists: ['andrei ionita', 'Nobody'], about: 'A.', listenFor: 'B.', recording: { conductor: 'Karajan', orchestra: 'BPO', soloists: [], year: '' } },
        { composer: '', title: 'nothing', catalogue: '', soloists: [], about: '', listenFor: '', recording: { conductor: '', orchestra: '', soloists: [], year: '' } },
      ],
    })
    expect(problems).toEqual([])
    expect(value.works).toHaveLength(1)
    expect(value.works[0]).toMatchObject({ composer: 'Dvořák', soloists: ['Andrei Ioniță'], about: 'A.', recording: { conductor: 'Karajan', orchestra: 'BPO' } })
    expect(validatePrepare({ works: [] }).problems).toHaveLength(1)
  })
})

describe('validateTaste', () => {
  const ctx = { feedbackIds: ['fb1'], observationIds: ['o1', 'o2', 'o3'] }
  const o = (extra) => ({ facet: 'composer', subject: 's', statement: 'A line.', stance: 'drawn-to', confidence: 'tentative', evidence: [], replaces: '', absorbs: [], ...extra })

  it('keeps a merge that cites no new feedback, and drops a new line that cites none', () => {
    const { value } = validateTaste({ observations: [o({ absorbs: ['o1', 'o2'] }), o({ statement: 'Unfounded.' })], questions: [] }, ctx)
    expect(value.observations.map((x) => x.statement)).toEqual(['A line.'])
    expect(value.observations[0].absorbs).toEqual(['o1', 'o2'])
  })

  it('absorbs only observations that exist, and never the one it replaces', () => {
    const { value } = validateTaste({ observations: [o({ evidence: ['fb1'], replaces: 'o1', absorbs: ['o1', 'o3', 'nope'] })], questions: [] }, ctx)
    expect(value.observations[0]).toMatchObject({ replaces: 'o1', absorbs: ['o3'] })
  })
})

describe('Shape next week', () => {
  const opt = (mood, title, shapedFrom = '') => ({ mood, title, pitch: 'p', character: [], why: 'w', angle: 'a', returningThemeId: '', continuityNote: '', form: 'theme', shapedFrom })
  const shaped = { where: 'either', sketches: [{ mood: 'immersive', title: 'Night music, slowly', line: 'l', nudge: '' }], leftToCurator: 'adventurous' }

  it('sends back a sketched slot written from nothing', () => {
    const { problems } = validateThemes({ options: [opt('immersive', 'Night'), opt('curious', 'B'), opt('adventurous', 'C')] }, { threadIds: [], shaped })
    expect(problems.some((p) => /written from the listener's sketch "Night music, slowly"/.test(p))).toBe(true)
  })

  it('mends a near-miss to the sketch’s own title, and clears a claim on the curator’s slot', () => {
    const { value, problems } = validateThemes({ options: [opt('immersive', 'Night music', 'night music slowly'), opt('curious', 'B'), opt('adventurous', 'C', 'made up')] }, { threadIds: [], shaped })
    expect(problems).toEqual([])
    expect(value.options.map((o) => o.shapedFrom)).toEqual(['Night music, slowly', '', ''])
  })

  it('keeps one sketch per slot asked for, never a title passed over', () => {
    const out = { sketches: [
      { mood: 'immersive', title: 'Spectral light', line: 'l', from: 'f' },
      { mood: 'curious', title: 'How a theme is built', line: 'l', from: 'f' },
      { mood: 'adventurous', title: 'Not asked', line: 'l', from: 'f' },
    ] }
    const r = validateSketch(out, { slots: ['immersive', 'curious'], avoid: ['spectral LIGHT'] })
    expect(r.value.sketches.map((s) => s.title)).toEqual(['How a theme is built'])
    expect(r.problems).toEqual(['"Spectral light" was sketched before; the immersive sketch must be another.', 'Sketch the immersive slot.'])
  })
})

import { describe, expect, it } from 'vitest'
import { MscxError, parseMscx } from './mscx'
import { unzipScore } from './mxl'
import { partsOf, suggestScoreParts } from './parts'
import { chord, measure2, measure4, mscx, tempo, timeSig, tuplet4, volta4 } from './testing/mscxBuilder'
import { CONTAINER, zip } from './testing/xmlBuilder'

const q = (pitch: number, o: { finger?: number; tie?: boolean } = {}) => ({ type: 'quarter', notes: [{ pitch, ...o }] })
const whole = (...pitches: number[]) => chord({ type: 'whole', notes: pitches.map((pitch) => ({ pitch })) })
const at = (file: ReturnType<typeof parseMscx>, staff: number) =>
  file.notes.filter((n) => n.channel === staff).map((n) => [n.pitch, Math.round(n.startMs)])

/**
 * A MuseScore 4 piano score with most of what a score can say: a pickup, a
 * repeat with first and second endings, a tie, a triplet with a grace note
 * before it, a second voice, a chord, fingering, and a change of tempo.
 */
const piano4 = () =>
  mscx({
    version: '4.20',
    title: 'Little Waltz',
    parts: [
      {
        name: 'Piano',
        staves: [
          [
            measure4([timeSig(4, 4) + tempo(60) + chord(q(67, { finger: 5 }))], { len: '1/4' }),
            measure4(
              [
                chord({ type: 'half', notes: [{ pitch: 72, finger: 1, tie: true }] }) +
                  chord(q(72)) +
                  tuplet4(2, 3) +
                  chord({ type: 'eighth', grace: true, notes: [{ pitch: 76 }] }) +
                  chord({ type: 'eighth', notes: [{ pitch: 74 }] }) +
                  chord({ type: 'eighth', notes: [{ pitch: 76 }] }) +
                  chord({ type: 'eighth', notes: [{ pitch: 78 }] }) +
                  '<endTuplet/>',
                whole(64),
              ],
              { start: true },
            ),
            measure4([tempo(120) + volta4('1') + whole(74)], { end: 2 }),
            measure4([volta4('2') + whole(72)]),
            measure4([whole(70)]),
          ],
          [
            measure4([timeSig(4, 4) + chord({ type: 'quarter' })], { len: '1/4' }),
            measure4([chord({ type: 'half', notes: [{ pitch: 48 }, { pitch: 55 }] }) + chord({ type: 'half', notes: [{ pitch: 43 }] })]),
            measure4([whole(43)]),
            measure4([whole(48)]),
            measure4([whole(36)]),
          ],
        ],
      },
    ],
  })

describe('parseMscx: MuseScore 3 and 4', () => {
  it('reads the notes in playing order: repeats, endings, ties, triplets, voices, tempo', () => {
    const file = parseMscx(piano4())
    expect(file.score?.title).toBe('Little Waltz')
    // The pickup is bar 0; the repeat plays bar 1 twice, then the second ending.
    expect(file.score?.barLabels).toEqual(['0', '1', '2', '1', '3', '4'])
    // The upper staff, as MuseScore plays it (the grace note left out); the tempo doubles at bar 2 and stays.
    expect(at(file, 1)).toEqual([
      [67, 0],
      [64, 1000],
      [72, 1000],
      [74, 4000],
      [76, 4333],
      [78, 4667],
      [74, 5000],
      [64, 7000],
      [72, 7000],
      [74, 8500],
      [76, 8667],
      [78, 8833],
      [72, 9000],
      [70, 11000],
    ])
    // The tied C is one note, three beats long (sounding for 90% of them).
    const tied = file.notes.find((n) => n.pitch === 72)!
    expect(tied.endMs - tied.startMs).toBeCloseTo(3000 * 0.9)
    expect(file.notes.filter((n) => n.channel === 1).map((n) => n.finger ?? '-').join('')).toBe('5-1-----1-----')
    expect(at(file, 2).slice(0, 3)).toEqual([
      [48, 1000],
      [55, 1000],
      [43, 3000],
    ])
    expect(file.tempos.map((t) => t.usPerQuarter)).toEqual([1_000_000, 500_000])
    expect(file.timeSignatures[0]).toMatchObject({ numerator: 4, denominator: 4 })
  })

  it('offers the staves as the hands', () => {
    const parts = partsOf(parseMscx(piano4()))
    expect(parts.map((p) => [p.name, p.staff, p.staves])).toEqual([
      ['Piano', 1, 2],
      ['Piano', 2, 2],
    ])
    const { right, left } = suggestScoreParts(parts)
    expect([right?.staff, left?.staff]).toEqual([1, 2])
  })

  it('leaves out tablature and percussion staves, and names each instrument', () => {
    const file = parseMscx(
      mscx({
        version: '3.02',
        parts: [
          { name: 'Guitar', staves: [[measure4([whole(64)])], [measure4([whole(64)])]], groups: ['pitched', 'tablature'] },
          { name: 'Drumset', staves: [[measure4([whole(38)])]], groups: ['percussion'] },
          { name: 'Flute', staves: [[measure4([whole(79)])]] },
        ],
      }),
    )
    expect(partsOf(file).map((p) => [p.name, p.noteCount])).toEqual([
      ['Guitar', 1],
      ['Flute', 1],
    ])
  })
})

describe('parseMscx: MuseScore 2', () => {
  it('reads voices after a <tick>, tuplets by id, ties, and an ending closed by its endSpanner', () => {
    const v2 = (c: Parameters<typeof chord>[0]) => chord(c, 2)
    const file = parseMscx(
      mscx({
        version: '2.06',
        title: 'Old Tune',
        parts: [
          {
            name: 'Piano',
            staves: [
              [
                measure2(
                  1,
                  timeSig(4, 4) +
                    tempo(60) +
                    v2(q(60, { tie: true, finger: 1 })) +
                    v2(q(60)) +
                    '<Tuplet id="1"><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>eighth</baseNote></Tuplet>' +
                    v2({ type: 'eighth', tupletId: '1', notes: [{ pitch: 62 }] }) +
                    v2({ type: 'eighth', tupletId: '1', notes: [{ pitch: 64 }] }) +
                    v2({ type: 'eighth', tupletId: '1', notes: [{ pitch: 65 }] }) +
                    v2({ type: 'quarter' }) +
                    '<tick>0</tick>' +
                    v2({ type: 'whole', track: 1, notes: [{ pitch: 55 }] }),
                ),
                measure2(2, v2({ type: 'whole', notes: [{ pitch: 69 }] }) + '<tick>1920</tick>' + v2({ type: 'whole', track: 1, notes: [{ pitch: 50 }] }), { start: true }),
                measure2(3, '<Volta id="3"><endings>1</endings></Volta>' + v2({ type: 'whole', notes: [{ pitch: 71 }] }), { end: 2 }),
                measure2(4, '<endSpanner id="3"/>' + v2({ type: 'whole', notes: [{ pitch: 72 }] })),
              ],
            ],
          },
        ],
      }),
    )
    expect(file.score?.title).toBe('Old Tune')
    expect(file.score?.barLabels).toEqual(['1', '2', '3', '2', '4'])
    expect(at(file, 1)).toEqual([
      [55, 0],
      [60, 0],
      [62, 2000],
      [64, 2333],
      [65, 2667],
      [50, 4000],
      [69, 4000],
      [71, 8000],
      [50, 12000],
      [69, 12000],
      [72, 16000],
    ])
    expect(file.notes.find((n) => n.pitch === 60)?.finger).toBe(1)
  })
})

describe('parseMscx: what it refuses', () => {
  it('says so for a file that isn’t MuseScore’s, or one too old to read', () => {
    expect(() => parseMscx('<score-partwise/>')).toThrow(MscxError)
    expect(() => parseMscx('<museScore version="1.14"><Score/></museScore>')).toThrow(expect.objectContaining({ kind: 'unsupported' }))
    expect(() => parseMscx('<museScore version="4.20"/>')).toThrow(expect.objectContaining({ kind: 'unsupported' }))
    expect(() => parseMscx('<museScore version="4.20"><Score><Part><Staff id="1"><StaffType group="percussion"/></Staff></Part></Score></museScore>')).toThrow(MscxError)
  })
})

describe('an .mscz file', () => {
  it('is a zip whose container names the score; without one, the score beside the parts', async () => {
    const text = piano4()
    const withContainer = await zip([
      { name: 'META-INF/container.xml', text: CONTAINER('Little Waltz.mscx'), deflate: true },
      { name: 'Thumbnails/thumbnail.png', text: 'png' },
      { name: 'Little Waltz.mscx', text, deflate: true },
    ])
    expect(await unzipScore(withContainer)).toBe(text)
    const without = await zip([
      { name: 'Excerpts/Piano/Piano.mscx', text: '<museScore/>' },
      { name: 'score_style.mss', text: '<museScore/>' },
      { name: 'Little Waltz.mscx', text },
    ])
    expect(await unzipScore(without)).toBe(text)
  })
})

import { describe, expect, it } from 'vitest'
import { looksLikeXml, MusicXmlError, parseMusicXml, playingOrder } from './musicxml'
import { isZip, MxlError, unzipScore } from './mxl'
import { partsOf, songFromParts, suggestScoreParts } from './parts'
import { barName, barSpan } from './song'
import { attributes, CONTAINER, endingStart, endingStop, measure, note, pianoBar, repeatEnd, repeatStart, score, tempo, zip } from './testing/xmlBuilder'
import { parseXml, XmlError } from './xml'

const q = (pitch: string | null, extra: Partial<Parameters<typeof note>[0]> = {}) => ({ pitch, beats: 1, ...extra })

/** Two bars of piano at 60 bpm: a quarter is a second. */
const piano = () =>
  score({
    title: 'Little Piece',
    parts: [
      {
        name: 'Piano',
        measures: [
          measure(1, attributes({ staves: 2 }) + tempo(60) + pianoBar([q('C4', { finger: 1 }), q('D4', { finger: 2 }), q('E4', { finger: 3 }), q('F4', { finger: 4 })], [{ pitch: 'C3', beats: 4, finger: 5 }])),
          measure(2, pianoBar([{ pitch: 'G4', beats: 4, finger: 5 }], [{ pitch: 'C3', beats: 2 }, { pitch: 'E3', beats: 2 }, { pitch: 'G3', beats: 2, chord: true }])),
        ],
      },
    ],
  })

describe('parseMusicXml', () => {
  it('reads a piano score: two staves, pitches, times, fingers, bars, title', () => {
    const file = parseMusicXml(piano())
    expect(file.score?.title).toBe('Little Piece')
    expect(file.score?.barLabels).toEqual(['1', '2'])
    const right = file.notes.filter((n) => n.channel === 1)
    expect(right.map((n) => n.pitch)).toEqual([60, 62, 64, 65, 67])
    expect(right.map((n) => n.startMs)).toEqual([0, 1000, 2000, 3000, 4000])
    expect(right.map((n) => n.finger)).toEqual([1, 2, 3, 4, 5])
    expect(right.map((n) => n.bar)).toEqual([0, 0, 0, 0, 1])
    // Notes sound for 90% of their value, so a repeated note reads as two.
    expect(right[0].endMs).toBe(900)
    // The left hand: a whole note, then a half and a two-note chord.
    const left = file.notes.filter((n) => n.channel === 2)
    expect(left.map((n) => [n.pitch, n.startMs])).toEqual([
      [48, 0],
      [48, 4000],
      [52, 6000],
      [55, 6000],
    ])
    expect(file.timeSignatures[0]).toMatchObject({ numerator: 4, denominator: 4 })
    expect(file.tempos[0].usPerQuarter).toBe(1_000_000)
  })

  it('offers the staves as the hands, and keeps fingers and printed bars in the song', () => {
    const file = parseMusicXml(piano())
    const parts = partsOf(file)
    expect(parts.map((p) => [p.name, p.staff, p.staves])).toEqual([
      ['Piano', 1, 2],
      ['Piano', 2, 2],
    ])
    const { right, left } = suggestScoreParts(parts)
    expect([right?.staff, left?.staff]).toEqual([1, 2])
    const song = songFromParts(file, { id: 's', title: 'x', right, left })
    expect(song.notes.filter((n) => n.hand === 'right').map((n) => n.finger)).toEqual([1, 2, 3, 4, 5])
    expect(song.notes.find((n) => n.hand === 'left')?.finger).toBe(5)
    expect(song.bpm).toBe(60)
    expect(song.barLabels).toEqual(['1', '2'])
    expect(barName(song, 1)).toBe('2')
  })

  it('names a stretch of bars as printed, each run on its own where a repeat goes back', () => {
    const song = { barLabels: ['0', '1', '2', '3', '4', '1', '2', '3', '4', '5'] }
    expect(barSpan(song, 1, 5)).toBe('1–4')
    expect(barSpan(song, 3, 7)).toBe('3–4, 1–2')
    expect(barSpan(song, 9, 10)).toBe('5')
    expect(barSpan({}, 0, 4)).toBe('1–4')
  })

  it('joins tied notes into one, across a bar line', () => {
    const file = parseMusicXml(
      score({
        parts: [{ name: 'Flute', measures: [measure(1, attributes() + tempo(60) + note(q('C5')) + note(q('C5')) + note({ pitch: 'D5', beats: 2, tie: 'start' })), measure(2, note({ pitch: 'D5', beats: 2, tie: 'both' }) + note({ pitch: 'D5', beats: 1, tie: 'stop' }) + note(q('E5')))] }],
      }),
    )
    expect(file.notes.map((n) => [n.pitch, n.startMs])).toEqual([
      [72, 0],
      [72, 1000],
      [74, 2000],
      [76, 7000],
    ])
    // The tied D lasts five beats (sounding for 90% of them).
    expect(file.notes[2].endMs).toBe(2000 + 5000 * 0.9)
  })

  it('writes out repeats and first and second endings in playing order', () => {
    const bars = [measure(1, attributes() + note({ pitch: 'C4', beats: 4 })), measure(2, endingStart('1') + note({ pitch: 'D4', beats: 4 }) + endingStop('1') + repeatEnd()), measure(3, endingStart('2') + note({ pitch: 'E4', beats: 4 }) + endingStop('2', 'discontinue')), measure(4, note({ pitch: 'F4', beats: 4 }))]
    const file = parseMusicXml(score({ parts: [{ name: 'Piano', measures: bars }] }))
    expect(file.score?.barLabels).toEqual(['1', '2', '1', '3', '4'])
    expect(file.notes.map((n) => n.pitch)).toEqual([60, 62, 60, 64, 65])
    expect(file.notes.map((n) => n.bar)).toEqual([0, 1, 2, 3, 4])
    // A repeat that starts part-way: back to its own start sign.
    const inner = [measure(1, attributes() + note({ pitch: 'C4', beats: 4 })), measure(2, repeatStart + note({ pitch: 'D4', beats: 4 })), measure(3, note({ pitch: 'E4', beats: 4 }) + repeatEnd()), measure(4, note({ pitch: 'F4', beats: 4 }))]
    expect(parseMusicXml(score({ parts: [{ name: 'Piano', measures: inner }] })).score?.barLabels).toEqual(['1', '2', '3', '2', '3', '4'])
  })

  it('plays a section as many times as it says, and a later section returns to its own start', () => {
    const b = (forward = false, backward: number | null | undefined = undefined, ending: number[] | null = null) => ({ forward, backward: backward === undefined ? null : { times: backward }, ending })
    // |: 1 2 :| 3 |: 4 :|x3
    expect(playingOrder([b(true), b(false, null), b(), b(true, 3)])).toEqual([0, 1, 0, 1, 2, 3, 3, 3])
    // No forward sign: back to the start. Endings 1 and 2 share a bar, 3 goes on.
    expect(playingOrder([b(), b(false, null, [1, 2]), b(false, undefined, [3]), b()])).toEqual([0, 1, 0, 1, 0, 2, 3])
  })

  it('counts a pickup as a short bar of its own', () => {
    const file = parseMusicXml(score({ parts: [{ name: 'Voice', measures: [measure(0, attributes({ beats: 3 }) + tempo(60) + note(q('G4')), true), measure(1, note(q('C5')) + note(q('C5')) + note(q('D5')))] }] }))
    expect(file.notes.map((n) => n.startMs)).toEqual([0, 1000, 2000, 3000])
    expect(file.notes.map((n) => n.bar)).toEqual([0, 1, 1, 1])
    expect(file.score?.barLabels).toEqual(['0', '1'])
    expect(file.timeSignatures[0].numerator).toBe(3)
  })

  it('follows a change of tempo', () => {
    const file = parseMusicXml(score({ parts: [{ name: 'P', measures: [measure(1, attributes() + tempo(60) + note({ pitch: 'C4', beats: 4 })), measure(2, tempo(120) + note(q('D4')) + note(q('E4')))] }] }))
    expect(file.notes.map((n) => n.startMs)).toEqual([0, 4000, 4500])
  })

  it('leaves out grace notes and cue notes, and sounds a transposing instrument where it sounds', () => {
    const file = parseMusicXml(
      score({ parts: [{ name: 'Clarinet in B♭', measures: [measure(1, attributes({ transpose: -2 }) + tempo(60) + note({ pitch: 'C5', beats: 0, grace: true }) + note(q('D4')) + note({ pitch: 'E4', beats: 1, cue: true }) + note(q(null)) + note(q('D4')))] }] }),
    )
    expect(file.notes.map((n) => [n.pitch, n.startMs])).toEqual([
      [60, 0],
      [60, 3000],
    ])
  })

  it('names a score without a staff split by its instruments', () => {
    const file = parseMusicXml(score({ parts: [{ name: 'Violin', measures: [measure(1, attributes() + note({ pitch: 'A4', beats: 4 }))] }, { name: 'Cello', measures: [measure(1, attributes() + note({ pitch: 'C3', beats: 4 }))] }] }))
    const parts = partsOf(file)
    expect(parts.map((p) => [p.name, p.staves])).toEqual([
      ['Violin', 1],
      ['Cello', 1],
    ])
    // No keyboard staves: the MIDI guess, the busiest line to the right hand.
    expect(suggestScoreParts(parts).right?.name).toBe('Violin')
  })

  it('says what is wrong with a file it cannot read', () => {
    expect(() => parseMusicXml('<html><body/></html>')).toThrow(MusicXmlError)
    expect(() => parseMusicXml('<score-timewise/>')).toThrow(expect.objectContaining({ kind: 'unsupported' }))
    expect(() => parseMusicXml('not xml at all')).toThrow(MusicXmlError)
    expect(looksLikeXml('﻿  <?xml version="1.0"?><a/>')).toBe(true)
    expect(looksLikeXml('MThd')).toBe(false)
  })
})

describe('parseXml', () => {
  it('reads elements, attributes, text, entities and CDATA; skips comments, the DOCTYPE and instructions', () => {
    const root = parseXml(`<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><!-- hi --><a b="1 &amp; 2" c='>'><d>R&#233;verie &lt;1&gt;</d><e/><f><![CDATA[<raw>]]></f></a>`)
    expect(root.name).toBe('a')
    expect(root.attrs).toEqual({ b: '1 & 2', c: '>' })
    expect(root.children.map((c) => c.name)).toEqual(['d', 'e', 'f'])
    expect(root.children[0].text).toBe('Réverie <1>')
    expect(root.children[2].text).toBe('<raw>')
  })

  it('refuses what isn’t well-formed', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlError)
    expect(() => parseXml('<a>')).toThrow(XmlError)
    expect(() => parseXml('text')).toThrow(XmlError)
  })
})

describe('unzipScore (.mxl)', () => {
  const text = piano()

  it('finds the score the container names, deflated or stored', async () => {
    for (const deflate of [true, false]) {
      const bytes = await zip([
        { name: 'META-INF/container.xml', text: CONTAINER('score/little.xml'), deflate },
        { name: 'score/little.xml', text, deflate },
      ])
      expect(isZip(bytes)).toBe(true)
      expect(await unzipScore(bytes)).toBe(text)
    }
  })

  it('without a container, takes the XML file that isn’t in META-INF', async () => {
    expect(await unzipScore(await zip([{ name: 'piece.musicxml', text, deflate: true }]))).toBe(text)
  })

  it('says so when there is no score inside, or it isn’t a zip', async () => {
    await expect(unzipScore(await zip([{ name: 'readme.txt', text: 'hi' }]))).rejects.toThrow(MxlError)
    await expect(unzipScore(new Uint8Array([1, 2, 3]))).rejects.toThrow(MxlError)
    expect(isZip(new TextEncoder().encode('<?xml'))).toBe(false)
  })
})

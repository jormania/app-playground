import { describe, expect, it, vi } from 'vitest'
import { answerLine, answerRecording, answerSong, askAnswer, callOf, checkAnswer, keyName, keyOf, parseNote, type Call } from './answer'

const n = (pitch: number, startMs: number, durationMs = 450) => ({ pitch, velocity: 80, startMs, durationMs })
/** C D E F G, a note every half second: C major at 120. */
const rising = { ms: 3000, pedal: [], notes: [60, 62, 64, 65, 67].map((p, i) => n(p, 100 + i * 500)) }

describe('the key she played in', () => {
  it('finds the scale holding her notes, leaning to where she started and ended', () => {
    expect(keyName(keyOf(rising.notes))).toBe('C major')
    // A C E D C B A: A minor, not C major, because it comes home to A.
    expect(keyName(keyOf([69, 72, 76, 74, 72, 71, 69].map((p, i) => n(p, i * 500))))).toBe('A minor')
    // G A B C D with F♯: G major, written with sharps.
    expect(keyName(keyOf([67, 69, 71, 72, 74, 66, 67].map((p, i) => n(p, i * 500))))).toBe('G major')
    expect(parseNote('F#4')).toBe(66)
    expect(parseNote('Bb3')).toBe(58)
    expect(parseNote('H4')).toBeNull()
  })
})

describe('callOf', () => {
  it('puts her phrase on a grid of beats: from the count-in when she had one, else from her own pace', () => {
    const counted = callOf({ ...rising, bpm: 60 })!
    expect(counted.notes.map((x) => x.start)).toEqual([0, 0.5, 1, 1.5, 2])
    const own = callOf(rising)!
    expect(own.bpm).toBe(120)
    expect(own.notes.map((x) => x.start)).toEqual([0, 1, 2, 3, 4])
    expect(own.notes[0].beats).toBe(1)
    expect([own.low, own.high, own.beats]).toEqual([60, 67, 5])
  })

  it('needs a few notes to answer', () => {
    expect(callOf({ ms: 1000, pedal: [], notes: [n(60, 0), n(62, 500)] })).toBeNull()
  })
})

describe('checkAnswer', () => {
  const call = callOf(rising)! as Call
  const reply = (notes: unknown, idea = 'Yours climbed up; mine walks back down home to C.') => JSON.stringify({ idea, notes })

  it('takes a phrase in the key, near her hands, in plain note values', () => {
    const a = checkAnswer(`Here you go: ${reply([{ note: 'G4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'rest', beats: 0.5 }, { note: 'E4', beats: 0.5 }, { note: 'D4', beats: 1 }, { note: 'C4', beats: 2 }])}`, call)!
    expect(a.notes.map((x) => [x.pitch, x.start, x.beats])).toEqual([
      [67, 0, 1],
      [65, 1, 1],
      [null, 2, 0.5],
      [64, 2.5, 0.5],
      [62, 3, 1],
      [60, 4, 2],
    ])
    expect(a.beats).toBe(6)
    expect(a.idea).toBe('Yours climbed up; mine walks back down home to C.')
  })

  it('drops anything she couldn’t play: out of the key, far from her hands, odd values, too long, or not JSON', () => {
    expect(checkAnswer(reply([{ note: 'F#4', beats: 1 }, { note: 'C4', beats: 1 }]), call)).toBeNull()
    expect(checkAnswer(reply([{ note: 'C6', beats: 1 }, { note: 'C4', beats: 1 }]), call)).toBeNull()
    expect(checkAnswer(reply([{ note: 'E4', beats: 1.25 }, { note: 'C4', beats: 1 }]), call)).toBeNull()
    expect(checkAnswer(reply(Array.from({ length: 20 }, () => ({ note: 'C4', beats: 1 }))), call)).toBeNull()
    expect(checkAnswer(reply([{ note: 'C4', beats: 4 }]), call)).toBeNull()
    expect(checkAnswer('I would play something gentle.', call)).toBeNull()
  })
})

describe('the answer, to hear and to learn', () => {
  const call = callOf(rising)!
  const a = checkAnswer(JSON.stringify({ idea: '', notes: [{ note: 'G4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'D4', beats: 2 }, { note: 'D4', beats: 1 }, { note: 'C4', beats: 3 }] }), call)!

  it('plays like a take at her tempo, and becomes a song of four-beat bars', () => {
    const r = answerRecording(a)
    expect(r.notes.map((x) => [x.pitch, x.startMs])).toEqual([
      [67, 0],
      [64, 500],
      [62, 1000],
      [62, 2000],
      [60, 2500],
    ])
    const song = answerSong(a, 'answer:1', 'Answer to Take 1')
    expect(song).toMatchObject({ id: 'answer:1', title: 'Answer to Take 1', bpm: 120, beatsPerBar: 4 })
    expect(song.notes.map((x) => x.bar)).toEqual([0, 0, 0, 1, 1])
    expect(song.notes.every((x) => x.hand === 'right')).toBe(true)
    expect(answerLine(a, (p) => String(p))).toBe('67 64 62  |  62 60')
  })

  it('is asked of Sonnet, with the key, her range and her notes', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ idea: 'Hi', notes: [{ note: 'E4', beats: 1 }, { note: 'C4', beats: 2 }] }) }], stop_reason: 'end_turn' }), { status: 200 }))
    const answer = await askAnswer('k', call, 'ro', { fetchImpl })
    expect(answer?.notes.map((x) => x.pitch)).toEqual([64, 60])
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.model).toMatch(/^claude-sonnet/)
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.system).toContain('C major')
    expect(body.system).toContain('Romanian')
    expect(body.messages[0].content).toContain('"note":"C4"')
  })
})

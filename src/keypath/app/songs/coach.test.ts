// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JudgeSummary, NoteResult, Report } from '../../engine'
import { songOf } from '../../engine/testing/songs'
import { askCoach, checkNote, coachFacts, readCoachKey, saveCoachKey, testCoachKey, type FactsInput } from './coach'

// Two bars: G A F# G | G F# E D, with fingers on the first bar.
const song = (() => {
  const s = songOf([67, 69, 66, 67, 67, 66, 64, 62].map((p, i): [number, number] => [p, i * 500]), 'Little Tune')
  const fingers = [3, 4, 2, 3]
  s.notes.forEach((n, i) => {
    if (i < 4) n.finger = fingers[i] as 1 | 2 | 3 | 4 | 5
  })
  return s
})()

/** She plays it through, but twice presses F where bar 1 has F♯, misses the D, and is late on the E. */
function attempt(): Omit<FactsInput, 'names' | 'language'> {
  const results: NoteResult[] = song.notes.map((note) => ({ note, outcome: note.pitch === 62 ? 'missed' : 'hit', timing: note.pitch === 64 ? 'late' : 'onTime' }))
  const summary: JudgeSummary = {
    results,
    wrong: [
      { pitch: 65, atMs: 1000, bar: 0 },
      { pitch: 65, atMs: 1010, bar: 0 },
    ],
    total: 8,
    done: true,
    mode: 'running',
  }
  const report: Report = { stars: 2, score: 0.78, hit: 7, total: 8, missed: 1, wrong: 2, timing: { early: 0, onTime: 6, late: 1 }, highlights: [], toWorkOn: [], suggestion: null }
  return { song, summary, report, practice: 'right', tempo: 0.75, earlier: [1, 2, 3, 4, 5, 6].map((stars) => ({ stars: stars % 3, score: stars * 10 })) }
}

describe('coachFacts', () => {
  it('says what went wrong where: the bars, the key beside the one wanted, the fingers, and the earlier tries', () => {
    const f = coachFacts({ ...attempt(), names: 'letters', language: 'en' })
    expect(f).toMatchObject({ song: 'Little Tune', hands: 'right', mode: 'running', speedPercent: 75, stars: 2, notesPlayed: 7, notesInSong: 8, missed: 1, wrongKeys: 2 })
    expect(f.troubleBars.map((b) => b.bar)).toEqual(['1', '2'])
    expect(f.troubleBars[0]).toMatchObject({ wrong: 2, notes: 'G(3) A(4) F♯(2) G(3)' })
    expect(f.troubleBars[1]).toMatchObject({ missed: 1, late: 1, notes: 'G F♯ E D' })
    expect(f.swaps).toEqual([{ bar: '1', played: 'F', expected: 'F♯', times: 2, expectedIsBlack: true }])
    // The last five earlier finishes only; and nothing about who she is.
    expect(f.earlier).toHaveLength(5)
    expect(JSON.stringify(f)).not.toMatch(/Nora|name/i)
  })

  it('names the notes the way she reads them, and bars as printed', () => {
    const printed = { ...song, barLabels: ['12', '13'] }
    const f = coachFacts({ ...attempt(), song: printed, names: 'auto', language: 'ro' })
    expect(f.swaps[0]).toMatchObject({ bar: '12', played: 'Fa', expected: 'Fa♯' })
  })
})

describe('checkNote', () => {
  it('keeps a short note that names only bars the song has', () => {
    expect(checkNote('“Nice steady start. In bar 1, reach for the black key: F♯ with finger 2.”', song)).toBe('Nice steady start. In bar 1, reach for the black key: F♯ with finger 2.')
    expect(checkNote('Loop bars 1 and 2 slowly.', song)).toBe('Loop bars 1 and 2 slowly.')
    expect(checkNote('Repetă măsura 2 de trei ori.', song)).toBe('Repetă măsura 2 de trei ori.')
  })

  it('drops a note that names a bar the song doesn’t have, or runs on', () => {
    expect(checkNote('Work on bar 7.', song)).toBeNull()
    expect(checkNote('Măsurile 2 și 9 au nevoie de atenție.', song)).toBeNull()
    expect(checkNote('', song)).toBeNull()
    expect(checkNote('word '.repeat(200), song)).toBeNull()
  })
})

describe('askCoach', () => {
  const facts = () => coachFacts({ ...attempt(), names: 'letters', language: 'en' })
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

  it('asks Haiku, in her language, with the facts and no name; and returns the note', async () => {
    const fetchImpl = reply({ content: [{ type: 'text', text: 'Good rhythm. In bar 1, F♯ is the black key: finger 2.' }], stop_reason: 'end_turn' })
    expect(await askCoach('sk-test', facts(), 'ro', song, undefined, fetchImpl)).toBe('Good rhythm. In bar 1, F♯ is the black key: finger 2.')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test')
    const body = JSON.parse(init.body as string)
    expect(body.model).toMatch(/^claude-haiku-4-5/)
    expect(body.system).toMatch(/Write in Romanian/)
    expect(body.messages[0].content).toContain('"song":"Little Tune"')
  })

  it('shows nothing rather than something wrong: an error, a refusal, a cut-off answer, a failed request', async () => {
    expect(await askCoach('k', facts(), 'en', song, undefined, reply({ error: {} }, 401))).toBeNull()
    expect(await askCoach('k', facts(), 'en', song, undefined, reply({ content: [{ type: 'text', text: 'x' }], stop_reason: 'refusal' }))).toBeNull()
    expect(await askCoach('k', facts(), 'en', song, undefined, reply({ content: [{ type: 'text', text: 'Play bar' }], stop_reason: 'max_tokens' }))).toBeNull()
    expect(await askCoach('k', facts(), 'en', song, undefined, reply({ content: [{ type: 'text', text: 'Fix bar 40.' }], stop_reason: 'end_turn' }))).toBeNull()
    expect(
      await askCoach('k', facts(), 'en', song, undefined, vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })),
    ).toBeNull()
  })
})

describe('the key', () => {
  beforeEach(() => localStorage.clear())

  it('is kept on the phone, trimmed, and removed when saved empty', () => {
    expect(readCoachKey()).toBe('')
    saveCoachKey('  sk-ant-abc  ')
    expect(readCoachKey()).toBe('sk-ant-abc')
    saveCoachKey('')
    expect(readCoachKey()).toBe('')
  })

  it('is tested with one tiny request, and the answer says what’s wrong', async () => {
    const status = (code: number, message = '') => vi.fn(async () => new Response(JSON.stringify({ error: { message } }), { status: code }))
    expect(await testCoachKey('k', status(200))).toBe('ok')
    expect(await testCoachKey('k', status(401))).toBe('bad-key')
    expect(await testCoachKey('k', status(400, 'Your credit balance is too low'))).toBe('no-credit')
    expect(await testCoachKey('k', status(429))).toBe('limited')
    expect(await testCoachKey('k', status(529))).toBe('busy')
    expect(await testCoachKey('k', status(400, 'something else'))).toBe('error')
    expect(
      await testCoachKey('k', vi.fn(async () => {
        throw new TypeError('offline')
      })),
    ).toBe('offline')
    const one = status(200)
    await testCoachKey(' sk-ant-x ', one)
    const body = JSON.parse((one.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.max_tokens).toBe(1)
  })
})

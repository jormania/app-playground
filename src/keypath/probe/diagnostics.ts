import { noteName } from '../midi/noteNames'
import type { NoteOff, NoteOn } from '../midi/types'

export type TestKind = 'anyKey' | 'repeat' | 'chord' | 'sweep'
export type NoteEvent = NoteOn | NoteOff

export interface TestSpec {
  kind: TestKind
  title: string
  instruction: string
  /** Tests that can't know when the player is done show a Finish button. */
  needsFinish: boolean
}

export const MIDDLE_C = 60
const CHORD = [60, 64, 67]
const REPEATS = 4

export const TESTS: TestSpec[] = [
  { kind: 'anyKey', title: 'Any key', instruction: 'Press any key on the Yamaha, then let go.', needsFinish: false },
  {
    kind: 'repeat',
    title: 'Repeated note',
    instruction: `Play middle C (${noteName(MIDDLE_C)} — the third C from the left) ${REPEATS} times, clearly separated.`,
    needsFinish: false,
  },
  { kind: 'chord', title: 'Chord', instruction: 'Play C4 + E4 + G4 together as one chord, hold briefly, release.', needsFinish: false },
  {
    kind: 'sweep',
    title: 'Glissando',
    instruction: 'Sweep your hand fast across as many white keys as you can, both directions, then tap Finish.',
    needsFinish: true,
  },
]

export type Verdict = 'waiting' | 'pass' | 'fail'

export interface TestResult {
  verdict: Verdict
  summary: string
  details: string[]
}

const ms = (x: number) => `${x.toFixed(1)} ms`

interface Pairing {
  ons: NoteOn[]
  pairs: { on: NoteOn; off: NoteOff }[]
  stillHeld: NoteOn[]
  orphans: NoteOff[]
  doubleOns: NoteOn[]
  outOfOrder: number
}

/** Walk the events in arrival order, matching each Note Off to its Note On. */
function pair(events: readonly NoteEvent[]): Pairing {
  const open = new Map<string, NoteOn>()
  const result: Pairing = { ons: [], pairs: [], stillHeld: [], orphans: [], doubleOns: [], outOfOrder: 0 }
  let last = -Infinity
  for (const e of events) {
    if (e.time < last) result.outOfOrder++
    last = Math.max(last, e.time)
    const k = `${e.channel}:${e.note}`
    if (e.type === 'noteon') {
      if (open.has(k)) result.doubleOns.push(e)
      open.set(k, e)
      result.ons.push(e)
    } else {
      const on = open.get(k)
      if (!on) result.orphans.push(e)
      else {
        result.pairs.push({ on, off: e })
        open.delete(k)
      }
    }
  }
  result.stillHeld = [...open.values()]
  return result
}

interface Attempt {
  ons: NoteOn[]
  /** True once every key of the attempt is back up. */
  complete: boolean
}

/** Split note events into attempts: first key down → all keys up. */
export function attempts(events: readonly NoteEvent[]): Attempt[] {
  const out: Attempt[] = []
  const held = new Set<string>()
  for (const e of events) {
    const k = `${e.channel}:${e.note}`
    if (e.type === 'noteon') {
      if (held.size === 0) out.push({ ons: [], complete: false })
      held.add(k)
      out[out.length - 1].ons.push(e)
    } else if (held.delete(k) && held.size === 0 && out.length) {
      out[out.length - 1].complete = true
    }
  }
  return out
}

function integrity(p: Pairing): string[] {
  const problems: string[] = []
  if (p.orphans.length) problems.push(`${p.orphans.length} Note Off with no matching Note On`)
  if (p.doubleOns.length) problems.push(`${p.doubleOns.length} Note On for a key already down (a lost Note Off)`)
  if (p.outOfOrder) problems.push(`${p.outOfOrder} event(s) arrived with an earlier timestamp than the one before`)
  return problems
}

/**
 * Judge a test from the note events captured since it started. Pure, so the
 * same verdicts can be re-derived from an exported report.
 *
 * `finished` is the player tapping Finish; tests that can tell on their own
 * when they are complete ignore it except to fail an incomplete attempt.
 */
export function evaluate(kind: TestKind, events: readonly NoteEvent[], finished = false): TestResult {
  const p = pair(events)
  const problems = integrity(p)
  const anyHeld = p.stillHeld.length > 0

  switch (kind) {
    case 'anyKey': {
      const first = p.pairs[0]
      if (!first) return waitingOr(finished, p.ons.length ? 'Key down received — waiting for the release.' : 'Waiting for a key…')
      const { on, off } = first
      return verdict(problems, `Received ${noteName(on.note)} (MIDI ${on.note}), velocity ${on.velocity}, channel ${on.channel}.`, [
        `Note On → Note Off: ${ms(off.time - on.time)}`,
        off.viaZeroVelocity ? 'Note Off arrived as Note On with velocity 0 (the Yamaha’s documented form).' : 'Note Off arrived as a true 8nH Note Off.',
        `Dispatch lag (platform stamp → our handler): ${ms(on.receivedAt - on.time)}`,
      ])
    }

    case 'repeat': {
      const hits = p.pairs.filter((x) => x.on.note === MIDDLE_C)
      const onsOfC = p.ons.filter((e) => e.note === MIDDLE_C).length
      const strays = p.ons.filter((e) => e.note !== MIDDLE_C)
      if ((onsOfC < REPEATS || anyHeld) && !finished) return { verdict: 'waiting', summary: `${Math.min(onsOfC, REPEATS)} of ${REPEATS} C4 presses received…`, details: [] }
      if (onsOfC !== REPEATS) problems.push(`Expected ${REPEATS} presses of C4, got ${onsOfC}`)
      if (strays.length) problems.push(`Other keys also pressed: ${strays.map((s) => noteName(s.note)).join(', ')}`)
      const intervals = hits.slice(1).map((h, i) => h.on.time - hits[i].on.time)
      return verdict(problems, `${hits.length} complete C4 presses, each Note On matched by its Note Off, in order.`, [
        `Velocities: ${hits.map((h) => h.on.velocity).join(', ')}`,
        `Held for: ${hits.map((h) => ms(h.off.time - h.on.time)).join(', ')}`,
        intervals.length ? `Onset to onset: ${intervals.map(ms).join(', ')}` : '',
      ].filter(Boolean))
    }

    case 'chord': {
      // Judge one attempt, not everything since the test started: an attempt
      // runs from the first key down to the moment every key is up again.
      // Single notes are ignored, so a stray tap or finding the keys first
      // doesn't count against the chord.
      const all = attempts(events)
      const chordTry = all.find((a) => a.complete && new Set(a.ons.map((e) => e.note)).size >= 2)
      if (!chordTry) {
        if (!finished) {
          const current = all.at(-1)
          const holding = current && !current.complete ? current.ons.length : 0
          return {
            verdict: 'waiting',
            summary: holding ? `Holding ${holding} note(s)…` : all.length ? 'Single notes don’t count — play all three together.' : 'Waiting for the chord…',
            details: [],
          }
        }
        return { verdict: 'fail', summary: 'Finished before a chord was played.', details: [] }
      }
      const got = new Set(chordTry.ons.map((e) => e.note))
      const missing = CHORD.filter((n) => !got.has(n))
      const extra = [...got].filter((n) => !CHORD.includes(n))
      if (missing.length) problems.push(`Missing: ${missing.map(noteName).join(', ')}`)
      if (extra.length) problems.push(`Unexpected: ${extra.map(noteName).join(', ')}`)
      const times = chordTry.ons.map((e) => e.time)
      const spread = Math.max(...times) - Math.min(...times)
      return verdict(problems, `All three chord notes received as separate Note Ons.`, [
        `Played: ${chordTry.ons.map((e) => noteName(e.note)).join(' → ')}`,
        `Onset spread (first to last key of the chord): ${ms(spread)}`,
        `Velocities: ${chordTry.ons.map((e) => `${noteName(e.note)} ${e.velocity}`).join(', ')}`,
        'The spread is mostly your fingers, not the cable — it tells the lesson engine how wide a “together” window must be.',
      ])
    }

    case 'sweep': {
      if (!finished) return { verdict: 'waiting', summary: `${p.ons.length} Note On / ${p.pairs.length} released so far…`, details: [] }
      if (p.ons.length < 8) problems.push(`Only ${p.ons.length} notes — sweep across more keys`)
      if (anyHeld) problems.push(`Stuck: ${p.stillHeld.map((e) => noteName(e.note)).join(', ')} never released`)
      const gaps = p.ons.slice(1).map((e, i) => e.time - p.ons[i].time)
      return verdict(problems, `${p.ons.length} fast notes, every one released, nothing lost.`, [
        `Distinct keys: ${new Set(p.ons.map((e) => e.note)).size}`,
        gaps.length ? `Fastest onset gap: ${ms(Math.min(...gaps))}` : '',
      ].filter(Boolean))
    }
  }
}

function waitingOr(finished: boolean, summary: string): TestResult {
  return finished ? { verdict: 'fail', summary: 'Finished before the test was complete.', details: [] } : { verdict: 'waiting', summary, details: [] }
}

function verdict(problems: string[], passSummary: string, details: string[]): TestResult {
  return problems.length
    ? { verdict: 'fail', summary: problems.join('; '), details }
    : { verdict: 'pass', summary: passSummary, details }
}

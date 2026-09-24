import type { JudgeEvent, JudgeSummary } from './judge'
import { NEXT_ON_WRONG, NEXT_TIMING, type JudgeSettings, type OnWrong, type Timing } from './settings'

/**
 * What the screen should do right now for one judge event. The engine decides
 * *whether* to show something; how it looks (a flash, a colour, a sound) is
 * the UI's business.
 */
export interface LiveCue {
  /** Light up a key she hit correctly. */
  confirm?: number
  /** Mark a wrong key she pressed. Absent in "Keep going", where nothing is shown live. */
  flashWrong?: number
  /** Mark a note that went by unplayed. Same rule as wrong notes. */
  flashMissed?: number
}

export function cueFor(event: JudgeEvent, settings: JudgeSettings): LiveCue | null {
  const showMistakes = settings.onWrong !== 'keepGoing'
  switch (event.type) {
    case 'hit':
      return { confirm: event.result.note.pitch }
    case 'wrong':
      return showMistakes ? { flashWrong: event.wrong.pitch } : null
    case 'missed':
      return showMistakes ? { flashMissed: event.result.note.pitch } : null
    default:
      return null
  }
}

/** A thing that went well, listed before anything to work on. Codes, not text: the shell words them in her language. */
export type Highlight =
  | { kind: 'notes'; hit: number; total: number }
  | { kind: 'streak'; count: number }
  | { kind: 'onTime'; count: number }
  | { kind: 'cleanBars'; bars: number[] }
  | { kind: 'finished' }

export interface BarToWorkOn {
  bar: number
  missed: number
  wrong: number
  early: number
  late: number
}

export type Suggestion = { setting: 'onWrong'; to: OnWrong } | { setting: 'timing'; to: Timing }

export interface Report {
  /** 1–3 once the piece is finished (finishing always earns one); 0 if abandoned. */
  stars: number
  /** 0–1: hit notes over expected notes, lowered by wrong notes only if the setting says so. */
  score: number
  hit: number
  total: number
  missed: number
  wrong: number
  timing: { early: number; onTime: number; late: number } | null
  /** Positives first — always. */
  highlights: Highlight[]
  /** Short: the single bar most worth another go. Detailed: every bar with something to fix. Off: none. */
  toWorkOn: BarToWorkOn[]
  /** A step up, only ever suggested — never applied. */
  suggestion: Suggestion | null
}

const STAR_AT = { three: 0.9, two: 0.7 }
/** A piece has to go this well before a harder setting is suggested. */
const SUGGEST_AT = 0.95

export function buildReport(s: JudgeSummary, settings: JudgeSettings): Report {
  const hits = s.results.filter((r) => r.outcome === 'hit')
  const missed = s.results.filter((r) => r.outcome === 'missed')
  const wrong = s.wrong.length
  const denominator = settings.wrongAffectsStars ? s.total + wrong : s.total
  const score = denominator === 0 ? 0 : hits.length / denominator
  const stars = !s.done ? 0 : score >= STAR_AT.three ? 3 : score >= STAR_AT.two ? 2 : 1

  const running = s.mode === 'running'
  const timing = running
    ? {
        early: hits.filter((r) => r.timing === 'early').length,
        onTime: hits.filter((r) => r.timing === 'onTime').length,
        late: hits.filter((r) => r.timing === 'late').length,
      }
    : null

  // Per bar, in song order.
  const bars = new Map<number, BarToWorkOn & { total: number }>()
  const bar = (b: number) => {
    if (!bars.has(b)) bars.set(b, { bar: b, total: 0, missed: 0, wrong: 0, early: 0, late: 0 })
    return bars.get(b)!
  }
  for (const r of s.results) {
    const b = bar(r.note.bar)
    b.total++
    if (r.outcome === 'missed') b.missed++
    if (r.timing === 'early') b.early++
    if (r.timing === 'late') b.late++
  }
  for (const w of s.wrong) bar(w.bar).wrong++
  const ordered = [...bars.values()].sort((a, b) => a.bar - b.bar)
  const trouble = (b: BarToWorkOn) => b.missed * 2 + b.wrong + (b.early + b.late) * 0.5
  const clean = ordered.filter((b) => b.total > 0 && trouble(b) === 0).map((b) => b.bar)

  const highlights: Highlight[] = []
  if (s.done) highlights.push({ kind: 'finished' })
  if (hits.length) highlights.push({ kind: 'notes', hit: hits.length, total: s.total })
  const streak = longestStreak(s)
  if (streak >= 3) highlights.push({ kind: 'streak', count: streak })
  if (timing && timing.onTime) highlights.push({ kind: 'onTime', count: timing.onTime })
  if (clean.length) highlights.push({ kind: 'cleanBars', bars: clean })

  const withTrouble = ordered.filter((b) => trouble(b) > 0).map(({ total: _t, ...b }) => b)
  const toWorkOn =
    settings.report === 'off'
      ? []
      : settings.report === 'short'
        ? withTrouble.sort((a, b) => trouble(b) - trouble(a) || a.bar - b.bar).slice(0, 1)
        : withTrouble

  let suggestion: Suggestion | null = null
  const cleanScore = s.total === 0 ? 0 : hits.length / (s.total + wrong)
  if (s.done && cleanScore >= SUGGEST_AT) {
    const nextWrong = NEXT_ON_WRONG[settings.onWrong]
    const nextTiming = NEXT_TIMING[settings.timing]
    if (nextWrong) suggestion = { setting: 'onWrong', to: nextWrong }
    else if (running && nextTiming) suggestion = { setting: 'timing', to: nextTiming }
  }

  return { stars, score, hit: hits.length, total: s.total, missed: missed.length, wrong, timing, highlights, toWorkOn, suggestion }
}

/** Most notes in a row played right, in song order, with no wrong note in between. */
function longestStreak(s: JudgeSummary): number {
  const timeline: { t: number; good: boolean }[] = [
    ...s.results.map((r) => ({ t: r.note.startMs, good: r.outcome === 'hit' })),
    // Wrong notes don't carry a song position in wait mode; placing them at
    // their bar's start is enough to break a streak where they happened.
    ...s.wrong.map((w) => ({ t: firstStartOfBar(s, w.bar), good: false })),
  ].sort((a, b) => a.t - b.t || Number(a.good) - Number(b.good))
  let best = 0
  let run = 0
  for (const e of timeline) {
    run = e.good ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function firstStartOfBar(s: JudgeSummary, bar: number): number {
  const inBar = s.results.filter((r) => r.note.bar === bar).map((r) => r.note.startMs)
  return inBar.length ? Math.min(...inBar) : Infinity
}

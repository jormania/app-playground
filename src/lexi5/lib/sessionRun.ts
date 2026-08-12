import { readJson, writeJson } from '../../shared/storage'

/**
 * Today's play record, per dictionary.
 *
 * Endless mode counts rounds (`lexi5_endless_progress`) but remembers nothing about how
 * they went — a practice session had no shape at all: no sense of how many you'd played,
 * how many you'd solved, or whether you were on a run. Lifetime stats can't answer that
 * either, since they never reset.
 *
 * Deliberately scoped to the local calendar day, matching the boundary the daily word
 * rolls over on. A "session" that survived a night's sleep wouldn't mean anything.
 */

const KEY = 'lexi5_today'

export interface DayRecord {
  /** `toDateString()` of the day this record covers. */
  date: string
  played: number
  won: number
  /** Consecutive wins ending at the most recent game. */
  run: number
  /** Longest run achieved today. */
  bestRun: number
}

const empty = (date: string): DayRecord => ({ date, played: 0, won: 0, run: 0, bestRun: 0 })

type Store = Record<string, DayRecord>

function today(): string {
  return new Date().toDateString()
}

/**
 * Today's record for a dictionary. Returns a zeroed record once the day rolls over.
 *
 * Deliberately takes no date: this tracks *when you played*, not which puzzle. An archived
 * game carries a past date, and threading that through here meant finishing one silently
 * wiped the current day's record — the prune step keeps only entries matching the date it
 * is given, so a past date discarded today's.
 */
export function getDayRecord(dictionary: string): DayRecord {
  const store = readJson<Store>(KEY, {})
  const record = store[dictionary]
  const date = today()
  if (!record || record.date !== date) return empty(date)
  return record
}

/**
 * Folds a finished game into today's record.
 *
 * Called once per completed game — including forfeits, which count as played and not won,
 * the same way they count against lifetime stats. Always filed under today, whatever
 * day's puzzle it was.
 */
export function recordFinishedGame(dictionary: string, won: boolean): DayRecord {
  const date = today()
  const store = readJson<Store>(KEY, {})
  const previous = store[dictionary]
  const base = !previous || previous.date !== date ? empty(date) : previous

  const run = won ? base.run + 1 : 0
  const next: DayRecord = {
    date,
    played: base.played + 1,
    won: base.won + (won ? 1 : 0),
    run,
    bestRun: Math.max(base.bestRun, run),
  }

  // Only today's records are worth keeping; anything stale is dropped rather than
  // accumulating a key per dictionary per day forever.
  const pruned: Store = {}
  for (const [key, value] of Object.entries(store)) {
    if (value && value.date === date) pruned[key] = value
  }
  pruned[dictionary] = next
  writeJson(KEY, pruned)
  return next
}

/** A short human summary, or null when there's nothing yet worth saying. */
export function describeDay(record: DayRecord): string | null {
  if (record.played === 0) return null
  const solved = `${record.won} of ${record.played} solved today`
  if (record.run >= 2) return `${solved} · ${record.run} in a row`
  return solved
}

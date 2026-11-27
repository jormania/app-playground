// A string of beads: one for each day she played, the days in a row joined
// (KEYPATH_TUTOR.md §9, "A string of days"). Shown on Home and in Progress at
// the family's wish, and made so that a missed day costs nothing: the string
// that ends is never called lost, the longest is kept, and the next day she
// plays starts a new one. "Played" is practice (PRACTICE_TYPES), as everywhere.

/** The calendar day `n` days after `date` (YYYY-MM-DD), on the phone's calendar. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(y, m - 1, d + n, 12)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export interface Run {
  /** Days in a row up to today, or up to yesterday while today isn't played yet: the string still open. */
  current: number
  /** Whether today is one of them. */
  playedToday: boolean
  /** The longest string so far. */
  best: number
}

/** The strings in the days she played (local YYYY-MM-DD, any order). */
export function runOf(days: readonly string[], today: string): Run {
  const set = new Set(days)
  const playedToday = set.has(today)
  let current = 0
  for (let d = playedToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++
  let best = 0
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue // not the start of a string
    let n = 0
    for (let x = d; set.has(x); x = addDays(x, 1)) n++
    best = Math.max(best, n)
  }
  return { current, playedToday, best }
}

export interface Bead {
  date: string
  played: boolean
  /** Played, and the day before too: drawn joined to it. */
  joined: boolean
  today: boolean
}

/** The last `count` days, oldest first, ending today. */
export function beads(days: readonly string[], today: string, count: number): Bead[] {
  const set = new Set(days)
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1)
    const played = set.has(date)
    return { date, played, joined: played && set.has(addDays(date, -1)), today: date === today }
  })
}

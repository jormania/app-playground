// Pairing Yoru's nights with the sleep the band recorded, and the one comparison
// worth showing. Pure functions — the fetching is in components/SleepNights.jsx.
//
// The honest limits, which the screen states rather than hides:
//   · A Fitbit's sleep onset is inferred from movement and heart rate. It is good
//     at "about when", not at the minute.
//   · You choose a blend by mood. A night you reach for "far storm" may already
//     be a restless one, so a slower blend can look worse for reasons that are
//     not the blend. Nothing here can separate the two; more nights only help.
// So the comparison needs MIN_PER_GROUP nights in at least two groups before it
// says anything, and it reports medians (one bad night can't swing a median).

export const MIN_PER_GROUP = 3

const BEFORE_MS = 60 * 60 * 1000 // band thinks you were asleep up to 1 h before Begin
const AFTER_MS = 4 * 60 * 60 * 1000 // and as late as 4 h after

/**
 * For each Yoru night, the sleep session that began closest after it — main
 * sleep preferred over a nap — and the minutes from Begin to sleep onset.
 */
export function matchNights(nights, sleeps) {
  const candidates = (sleeps || []).filter((s) => s && s.onset && !s.nap)
  return (nights || []).map((n) => {
    let best = null
    for (const s of candidates) {
      const onset = Date.parse(s.onset)
      const d = onset - n.startedAt
      if (d < -BEFORE_MS || d > AFTER_MS) continue
      const better = !best
        || (s.mainSleep && !best.s.mainSleep)
        || (s.mainSleep === best.s.mainSleep && Math.abs(d) < Math.abs(best.d))
      if (better) best = { s, d }
    }
    if (!best) return { ...n, sleep: null, latency: null }
    return { ...n, sleep: best.s, latency: Math.max(0, Math.round(best.d / 60000)) }
  })
}

export function median(xs) {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}

const BY = {
  blend: (n) => n.blend || 'own blend',
  breathwork: (n) => (n.breathwork ? 'with breathwork' : 'without breathwork'),
  screen: (n) => ({ lit: 'screen lit', dark: 'screen dark', off: 'screen off' }[n.screen] || 'screen lit'),
}

/**
 * Group matched nights by one dimension. Returns null unless at least two groups
 * each have MIN_PER_GROUP matched nights — otherwise there is nothing to compare.
 * Groups are sorted fastest to sleep first; `deep` is the median deep-sleep minutes.
 */
export function compareBy(matched, dimension) {
  const key = BY[dimension]
  if (!key) return null
  const groups = new Map()
  for (const n of matched || []) {
    if (!n.sleep || n.latency === null) continue
    const k = key(n)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(n)
  }
  const rows = [...groups.entries()]
    .filter(([, list]) => list.length >= MIN_PER_GROUP)
    .map(([label, list]) => ({
      label,
      nights: list.length,
      latency: median(list.map((n) => n.latency)),
      deep: median(list.map((n) => n.sleep.deep)),
      asleep: median(list.map((n) => n.sleep.minutesAsleep)),
    }))
    .sort((a, b) => a.latency - b.latency)
  return rows.length >= 2 ? rows : null
}

/** "7h 12m" / "48m" */
export function hm(minutes) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

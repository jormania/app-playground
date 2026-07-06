// A "night" in Yoru isn't a calendar day — it rolls over at 4am, so a session
// begun at 12:40am still belongs to the night that started the evening before.
// The note and the in-progress session resume within the SAME night and are
// discarded once a new night begins.

const ROLLOVER_HOUR = 4

// A stable string key for the night that timestamp `ts` (ms) falls in.
export function nightKey(ts = Date.now()) {
  const d = new Date(ts - ROLLOVER_HOUR * 60 * 60 * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Do two timestamps belong to the same Yoru night?
export function sameNight(a, b) {
  return nightKey(a) === nightKey(b)
}

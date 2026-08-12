/** Calendar-day arithmetic for the daily word. */

function daysSinceEpoch(dateString: string): number {
  const d = new Date(dateString)
  // Force parsing to UTC noon to avoid any midnight DST boundary shifts or timezone drift
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  return Math.floor(utc / 86400000)
}

export { daysSinceEpoch }

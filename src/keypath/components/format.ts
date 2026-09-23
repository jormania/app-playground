/** Seconds since session start with ms precision — the log's "12.381". */
export const clock = (t: number, origin: number) => ((t - origin) / 1000).toFixed(3)
export const ms = (x: number | null | undefined, digits = 1) => (x === null || x === undefined ? '—' : `${x.toFixed(digits)} ms`)

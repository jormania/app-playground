export interface Summary {
  n: number
  min: number
  median: number
  p95: number
  max: number
}

/** min / median / p95 / max of a sample, or null when empty. Nearest-rank percentiles. */
export function summarise(samples: readonly number[]): Summary | null {
  if (samples.length === 0) return null
  const s = [...samples].sort((a, b) => a - b)
  const rank = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]
  return { n: s.length, min: s[0], median: rank(0.5), p95: rank(0.95), max: s[s.length - 1] }
}

/** A bounded FIFO of samples — the probe may run for an hour of practice. */
export function pushSample(samples: readonly number[], value: number, keep = 2000): number[] {
  const next = samples.length >= keep ? samples.slice(samples.length - keep + 1) : [...samples]
  next.push(value)
  return next
}

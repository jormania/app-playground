// Progressive-enhancement fetch: asks the server for a fresher, cron-generated
// scenario/explanation for a given law. Never throws — any failure (network,
// non-200, malformed shape) resolves to null, and the caller keeps using the
// static bundled laws.json text as-is.
export async function fetchFreshContent(lawId) {
  try {
    const res = await fetch(`/api/law-of-the-day-content?lawId=${lawId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.scenarioText !== 'string' || typeof data.explanationText !== 'string') {
      return null
    }
    return data
  } catch {
    return null
  }
}

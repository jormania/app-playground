/**
 * The way back after a drill-down, as The Long Listen's BackLink does it: a
 * report row that opens its payments remembers where it came from, by name,
 * and the Income screen offers "← Back to …". The tab bar clears it.
 */
const KEY = 'inflow:trail'

export interface Trail { hash: string; label: string }

export function leaveTrail(label: string): void {
  try { sessionStorage.setItem(KEY, JSON.stringify({ hash: location.hash || '#/overview', label })) } catch { /* private mode */ }
}

export function readTrail(): Trail | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Trail | null } catch { return null }
}

export function clearTrail(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* private mode */ }
}

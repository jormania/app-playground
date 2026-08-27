// Talking to /api/marquee-scan, and remembering what the last scan saw.
//
// The endpoint is stateless: this client sends the venue list, gets back parsed
// events, and owns the diff against its own snapshot. That is the same division of
// labour as Click Deck's studio search — the server parses, the browser decides
// what is news.

import { readJson, writeJson } from '../shared/storage'
import { toSnapshot, diff } from './changes.js'
import { scanPayload } from './programme.js'

const SNAPSHOT_KEY = 'marquee_snapshot'
const LAST_SCAN_KEY = 'marquee_last_scan'

export const SCAN_URL = '/api/marquee-scan'

export function loadSnapshot() { return readJson(SNAPSHOT_KEY, null) }
export function saveSnapshot(snapshot) { writeJson(SNAPSHOT_KEY, snapshot) }

/** The last scan's full results, so reopening the app shows the programme without
 *  re-fetching seven venues. */
export function loadLastScan() { return readJson(LAST_SCAN_KEY, null) }
export function saveLastScan(scan) { writeJson(LAST_SCAN_KEY, scan) }

/**
 * Run a scan and work out what changed.
 *
 * Returns `{ scannedAt, venues, events, changes, hadSnapshot }`. The snapshot is
 * advanced only for venues that actually answered — see `diff`'s rule 2: letting a
 * throttled venue clear its own events would report the whole programme as
 * cancelled and then, next scan, as brand new.
 */
export async function runScan(venues, { fetchImpl = fetch, now = new Date() } = {}) {
  const payload = scanPayload(venues)
  if (payload.length === 0) {
    return { scannedAt: now.toISOString(), venues: [], events: [], changes: [], hadSnapshot: true, nothingToScan: true }
  }

  const res = await fetchImpl(SCAN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ venues: payload }),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) throw new Error(data?.message || `The scan failed (${res.status}).`)

  const answered = (data.venues ?? []).filter((v) => v.status === 'ok' || v.status === 'empty')
  const answeredNames = answered.map((v) => v.venue)

  const previous = loadSnapshot()
  const current = { ...toSnapshot(data.events, data.scannedAt), answeredVenues: answeredNames }
  const { changes, hadSnapshot } = diff(previous, current, { now })

  // Carry forward what a silent venue last showed, so its programme doesn't
  // vanish from the app (and from the next diff) because of one bad request.
  const carried = { ...current.events }
  if (previous) {
    for (const [key, event] of Object.entries(previous.events ?? {})) {
      if (!carried[key] && !answeredNames.includes(event.venue)) carried[key] = event
    }
  }
  saveSnapshot({ scannedAt: current.scannedAt, events: carried })

  // Carried on the scan itself, not held in component state: "nothing new since
  // Tuesday" is a claim about the gap between two checks, and a reload used to
  // lose the earlier end of it and fall back to reporting the gap as ending at
  // the check you are looking at ("nothing new since earlier today", after a
  // check that ran a week ago).
  const scan = {
    scannedAt: data.scannedAt,
    previousScanAt: previous?.scannedAt ?? null,
    venues: data.venues ?? [],
    events: data.events ?? [],
    changes,
    hadSnapshot,
  }
  saveLastScan(scan)
  return scan
}

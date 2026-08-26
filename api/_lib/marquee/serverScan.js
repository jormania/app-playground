// The scheduled check — MARQUEE.md §7's deferred half, built.
//
// No new cron entry and no new serverless function: this piggybacks on
// Wanderlist's existing reminder cron (api/wanderlist-remind.js already fires
// once an evening, DST-adjusted) and appends whatever changed to that same
// email. Marquee gets a server-side snapshot of its own in KV — separate from
// the client's localStorage one, because they answer different questions: the
// client's snapshot is "what changed since I last opened the app", the
// server's is "what changed since the last scheduled check". Two independent,
// equally honest histories, not one shared state two writers could race on.
//
// Requires MARQUEE_NOTION_TOKEN (a fresh, small env var — the browser's BYO
// token never reaches this function, by design, so scheduled checking needs
// its own copy of a token that can read the Watched Venues database).
// MARQUEE_VENUES_DB_ID defaults to the one real database if unset. Missing the
// token is read as "not configured yet", not an error — the reminder email
// keeps working exactly as it did before this existed.

import { scanVenue, horizonFor } from './scan.js'
import { diff, toSnapshot, summarize } from './diff.js'
import { queryActiveVenues, writeScanResult } from './serverVenues.js'
import { kvGet, kvSet } from '../kv.js'

const SNAPSHOT_KEY = 'marquee:server-snapshot'
const DEFAULT_VENUES_DB_ID = '7c2ed57e41b74660868f014e9965ff19' // "Marquee — Watched Venues"

/**
 * Scan every active venue, diff against the last SCHEDULED check, and record
 * this one. Returns `{ configured, changes, venues }` — `configured: false`
 * when MARQUEE_NOTION_TOKEN isn't set, which the caller treats as "there is
 * nothing to add", not a failure.
 */
export async function runScheduledCheck(now = new Date()) {
  const token = process.env.MARQUEE_NOTION_TOKEN
  if (!token) return { configured: false, changes: [], venues: [] }
  const dbId = process.env.MARQUEE_VENUES_DB_ID || DEFAULT_VENUES_DB_ID

  const active = (await queryActiveVenues(token, dbId))
    .filter((v) => v.url && v.adapter && v.adapter !== 'unsupported')

  const results = []
  for (const venue of active) {
    const result = await scanVenue(venue, { now, horizonDays: horizonFor(venue) })
    results.push(result)
    // Best-effort: keeps the venue rows' Last Checked/Last Result current even
    // on nights nobody opens the app, which is the whole point of a scheduled
    // check — but a write failing here must not cancel the check itself.
    if (venue.id) {
      try { await writeScanResult(token, venue.id, { checkedAt: result.checkedAt, result: summarize(result) }) }
      catch { /* bookkeeping only */ }
    }
  }

  const answeredVenues = results.filter((r) => r.status === 'ok' || r.status === 'empty').map((r) => r.venue)
  const events = results.flatMap((r) => r.events)
  const current = { ...toSnapshot(events, now.toISOString()), answeredVenues }

  const previous = await kvGet(SNAPSHOT_KEY)
  const { changes } = diff(previous, current, { now })
  await kvSet(SNAPSHOT_KEY, current)

  return { configured: true, changes, venues: results }
}

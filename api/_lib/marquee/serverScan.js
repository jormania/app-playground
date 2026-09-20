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
//
// ── The run has a budget, and says when it spends it (§9.89) ─────────────────
// The loop below is sequential and every venue in it costs more than it used
// to (a seat lookup per open showing, a detail hop per production), so "scan
// them all" stopped being a thing a single invocation could promise. It used to
// promise it anyway, and the platform kept it honest by killing the function
// mid-list — leaving the last venue's row wearing an older date and no way for
// anyone, human or agent, to tell "checked a while ago" from "never checked".
// So the run now owns the limit instead of discovering it: it stops on a clock
// it can see, records the skip on the skipped venues' own rows, reports it to
// the caller, and starts the next run with whatever it dropped.

import { scanVenue, horizonFor, REQUEST_TIMEOUT_MS } from './scan.js'
import { diff, toSnapshot, summarize, carryUnanswered } from './diff.js'
import { queryActiveVenues, writeScanResult, writeNotChecked } from './serverVenues.js'
import { kvGet, kvSet } from '../kv.js'

const SNAPSHOT_KEY = 'marquee:server-snapshot'
/** Which venue the next run should begin with — see `rotate` below. */
const CURSOR_KEY = 'marquee:server-scan-cursor'
const DEFAULT_VENUES_DB_ID = '7c2ed57e41b74660868f014e9965ff19' // "Marquee — Watched Venues"

/**
 * The clock the loop runs against, in milliseconds from the START OF THE
 * INVOCATION — not from the start of this function, because the Wanderlist
 * queries this rides behind spend some of the same ceiling.
 *
 * `api/wanderlist-remind.js` declares `maxDuration = 300`, so 300s is the whole
 * budget the platform will allow, and these two numbers carve it up:
 *
 *   0 ──────────────── 210s ──────── 270s ─────── 300s
 *     start new venues │ finish this │ send the   │ platform
 *                      │ one         │ email      │ kills it
 *
 * `START_BUDGET_MS` is the last moment a NEW venue may be begun. A venue
 * already underway then has until `HARD_BUDGET_MS`, which is also what clamps
 * its remaining per-request timeouts — a site that accepts a connection and
 * never answers can cost a venue, never the email. The 30s tail is for the
 * truncation writes, the snapshot, and Resend.
 *
 * Both are deliberately generous rather than tight: a run that finishes has no
 * use for them at all, and the whole point of §9.89 is that a run that doesn't
 * finish is now reported rather than hidden, so the budget being conservative
 * costs a legible line in an email, not a silent hole.
 */
export const START_BUDGET_MS = 210_000
export const HARD_BUDGET_MS = 270_000

/**
 * Begin with the venue the last run gave up on.
 *
 * `queryActiveVenues` returns Notion's default order, which is stable, so a
 * fixed starting point means the same tail of the list is dropped every single
 * night — and the newest venue, being last, is the one that never gets checked
 * at all. Rotating blindly would spread the loss around; resuming from the
 * recorded skip does better than that, because the venue that went unread is
 * the one with the most to catch up on.
 *
 * A cursor naming a venue that has since been paused or deleted simply doesn't
 * match, and the run starts at the top — the degradation a missing cursor
 * should have.
 */
export function rotate(venues, cursorId) {
  const at = cursorId ? venues.findIndex((v) => v.id === cursorId) : -1
  return at > 0 ? [...venues.slice(at), ...venues.slice(0, at)] : venues
}

/** What a skipped venue's own row is made to say. Carries the date of the run
 *  that skipped it, because Last Checked deliberately still shows the older,
 *  true one (see `writeNotChecked`) and a reader needs both halves in one place
 *  to draw the right conclusion. */
export function notCheckedNote({ on, checked, total }) {
  return `not checked on ${on} — the scheduled run ran out of time after ${checked} of ${total} venues; this one is first in line next run`
}

/**
 * Scan every active venue, diff against the last SCHEDULED check, and record
 * this one. Returns `{ configured, changes, venues, truncated, writeFailures }`
 * — `configured: false` when MARQUEE_NOTION_TOKEN isn't set, which the caller
 * treats as "there is nothing to add", not a failure.
 *
 * `truncated` is `null` on a run that got through the whole list and
 * `{ checked, total, skipped: [names] }` on one that didn't. `writeFailures` is
 * the venues whose Notion bookkeeping was refused. Both are non-empty only when
 * something went wrong, and BOTH must reach the reader — a scheduled check that
 * quietly did less than it claims is the failure mode this app is built against.
 */
export async function runScheduledCheck(now = new Date(), {
  startedAt = Date.now(),
  startBudgetMs = START_BUDGET_MS,
  hardBudgetMs = HARD_BUDGET_MS,
} = {}) {
  const token = process.env.MARQUEE_NOTION_TOKEN
  if (!token) return { configured: false, changes: [], venues: [], truncated: null, writeFailures: [] }
  const dbId = process.env.MARQUEE_VENUES_DB_ID || DEFAULT_VENUES_DB_ID

  const active = (await queryActiveVenues(token, dbId))
    .filter((v) => v.url && v.adapter && v.adapter !== 'unsupported')
  const ordered = rotate(active, await kvGet(CURSOR_KEY))

  const results = []
  const skipped = []
  const writeFailures = []
  const record = async (venue, write) => {
    // Best-effort: keeps the venue rows' Last Checked/Last Result current even
    // on nights nobody opens the app, which is the whole point of a scheduled
    // check — but a write failing here must not cancel the check itself. It
    // must, however, be COUNTED: a row that silently stopped accepting writes
    // looks exactly like a venue that was never scanned, which is the same
    // ambiguity §9.89 is about.
    if (!venue.id) return
    try { await write() } catch { writeFailures.push(venue.name) }
  }

  for (let i = 0; i < ordered.length; i++) {
    const venue = ordered[i]
    if (Date.now() - startedAt >= startBudgetMs) {
      skipped.push(...ordered.slice(i))
      break
    }
    // A venue begun near the line gets whatever is left of the hard budget, so
    // one unanswering socket can't run past the ceiling and take the email with
    // it. Never below a second: a doomed request is still better than a request
    // aborted before it was made, which would report a working venue as dead.
    const remaining = Math.max(1000, hardBudgetMs - (Date.now() - startedAt))
    const result = await scanVenue(venue, {
      now,
      horizonDays: horizonFor(venue),
      timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remaining),
    })
    results.push(result)
    await record(venue, () => writeScanResult(token, venue.id, { checkedAt: result.checkedAt, result: summarize(result) }))
  }

  const truncated = skipped.length > 0
    ? { checked: results.length, total: ordered.length, skipped: skipped.map((v) => v.name) }
    : null

  if (truncated) {
    // Say it on the rows themselves, not only in the email. The row is where
    // the question actually gets asked — "when was this venue last checked, and
    // what did it find" — and an email is read once.
    const note = notCheckedNote({ on: now.toISOString().slice(0, 10), checked: truncated.checked, total: truncated.total })
    for (const venue of skipped) await record(venue, () => writeNotChecked(token, venue.id, note))
  }
  // Resume where this run gave up; clear the cursor when it got all the way
  // round, so a list that fits again goes back to its natural order.
  await kvSet(CURSOR_KEY, skipped[0]?.id ?? null)

  const answeredVenues = results.filter((r) => r.status === 'ok' || r.status === 'empty').map((r) => r.venue)
  const events = results.flatMap((r) => r.events)
  const previous = await kvGet(SNAPSHOT_KEY)
  // Carried BEFORE the diff, not after: a venue this run never reached keeps
  // exactly the entries it had, so those entries match `previous` and produce no
  // changes, and the stored snapshot has no hole for the next run to misread as
  // twenty brand-new showings. See carryUnanswered.
  const current = carryUnanswered(previous, { ...toSnapshot(events, now.toISOString()), answeredVenues })

  const { changes } = diff(previous, current, { now })
  await kvSet(SNAPSHOT_KEY, current)

  return { configured: true, changes, venues: results, truncated, writeFailures }
}

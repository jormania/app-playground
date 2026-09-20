// Renders Marquee's changes as a section appended to Wanderlist's own reminder
// email, rather than a second email of its own — one nightly message, not two
// competing for attention. See api/wanderlist-remind.js for where this splices
// in.

import { CHANGE, CHANGE_LABEL } from './diff.js'
import { seatsNote } from './shared.js'

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

/** The change's own label, qualified when what opened is nearly gone (§9.68). */
function kindLabel(change) {
  const note = seatsNote(change.seatsLeft)
  return note ? `${CHANGE_LABEL[change.kind]}, ${note}` : CHANGE_LABEL[change.kind]
}

function line(change) {
  const bits = [`${change.venue}`]
  if (change.date) bits.push(change.date)
  if (change.time) bits.push(change.time)
  return `${change.title} — ${kindLabel(change)} (${bits.join(' · ')})`
}

/**
 * What the run failed to do, in sentences — §9.89.
 *
 * A check that reached fourteen of seventeen venues has told you about fourteen
 * venues, and an email that reports only the changes it found reads exactly like
 * one from a complete run. That is the whole bug: not that a run can be
 * truncated, but that a truncated one was indistinguishable from a clean one.
 * So the shortfall is stated in the same breath as the findings, and — this is
 * the load-bearing part — it is enough on its own to make the email worth
 * sending on a night when nothing changed at all.
 */
function troubleLines({ truncated, writeFailures } = {}) {
  const lines = []
  if (truncated) {
    lines.push(`The venue check did not finish: ${truncated.checked} of ${truncated.total} venues were checked before it ran out of time.`)
    lines.push(`Not checked, so nothing below can speak for them: ${truncated.skipped.join(', ')}. Next run starts with them.`)
  }
  if (writeFailures?.length) {
    lines.push(`Notion refused the bookkeeping write for: ${writeFailures.join(', ')} — those rows still show an older result.`)
  }
  return lines
}

/** `{ text, html }`, each meant to be appended to an already-built email —
 *  `text` with a leading blank line, `html` as a standalone block ready to
 *  splice in before the closing `</div>`. Empty strings when there is nothing
 *  to say, so the caller can always append unconditionally. */
export function marqueeEmailSection(changes, trouble = {}) {
  const list = changes ?? []
  const troubles = troubleLines(trouble)
  if (list.length === 0 && troubles.length === 0) return { text: '', html: '' }

  const heading = list.length === 0
    ? 'Nothing changed at the venues that were checked — but:'
    : list.length === 1
      ? 'And one thing changed at your venues:'
      : `And ${list.length} things changed at your venues:`

  const bullets = list.map((c) => `• ${line(c)}`).join('\n')
  const text = `\n\n${heading}\n${list.length ? `\n${bullets}\n` : ''}${troubles.length ? `\n${troubles.map((l) => `⚠ ${l}`).join('\n')}\n` : ''}`

  const items = list.map((c) => {
    const meta = [c.venue, c.date, c.time].filter(Boolean).join(' · ')
    return `<li style="margin:6px 0">${esc(c.title)} <span style="color:#8a7f6a">— ${esc(kindLabel(c))} (${esc(meta)})</span></li>`
  }).join('')
  const warnings = troubles
    .map((l) => `<p style="margin:6px 0;color:#a8442a">⚠ ${esc(l)}</p>`)
    .join('')
  const html = `<p>${esc(heading)}</p>${list.length ? `<ul style="padding-left:18px">${items}</ul>` : ''}${warnings}`

  return { text, html }
}

/** The subject line for a night where Marquee has news but Wanderlist has
 *  nothing due — otherwise the base email's own subject (about what's due
 *  tomorrow) stays exactly as Wanderlist built it.
 *
 *  An unfinished run leads, even over a ticket opening: the changes are the
 *  point on a normal night, but on this one the more important fact is that the
 *  list they were drawn from is incomplete. */
export function marqueeOnlySubject(changes, { truncated } = {}) {
  if (truncated) return `Marquee: the venue check ran out of time (${truncated.checked}/${truncated.total})`
  if (changes.length === 0) return 'Marquee: the venue check had trouble'
  if (changes.length === 1) return `Marquee: “${changes[0].title}” — ${CHANGE_LABEL[changes[0].kind]}`
  const opened = changes.filter((c) => c.kind === CHANGE.TICKETS_OPENED).length
  return opened > 0
    ? `Marquee: ${opened} tickets just opened`
    : `Marquee: ${changes.length} changes at your venues`
}

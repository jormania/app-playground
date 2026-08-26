// Renders Marquee's changes as a section appended to Wanderlist's own reminder
// email, rather than a second email of its own — one nightly message, not two
// competing for attention. See api/wanderlist-remind.js for where this splices
// in.

import { CHANGE, CHANGE_LABEL } from './diff.js'

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function line(change) {
  const bits = [`${change.venue}`]
  if (change.date) bits.push(change.date)
  if (change.time) bits.push(change.time)
  return `${change.title} — ${CHANGE_LABEL[change.kind]} (${bits.join(' · ')})`
}

/** `{ text, html }`, each meant to be appended to an already-built email —
 *  `text` with a leading blank line, `html` as a standalone block ready to
 *  splice in before the closing `</div>`. Empty strings when there is nothing
 *  to say, so the caller can always append unconditionally. */
export function marqueeEmailSection(changes) {
  if (!changes || changes.length === 0) return { text: '', html: '' }

  const heading = changes.length === 1
    ? 'And one thing changed at your venues:'
    : `And ${changes.length} things changed at your venues:`

  const text = `\n\n${heading}\n\n${changes.map((c) => `• ${line(c)}`).join('\n')}\n`

  const items = changes.map((c) => {
    const meta = [c.venue, c.date, c.time].filter(Boolean).join(' · ')
    return `<li style="margin:6px 0">${esc(c.title)} <span style="color:#8a7f6a">— ${esc(CHANGE_LABEL[c.kind])} (${esc(meta)})</span></li>`
  }).join('')
  const html = `<p>${esc(heading)}</p><ul style="padding-left:18px">${items}</ul>`

  return { text, html }
}

/** The subject line for a night where Marquee has news but Wanderlist has
 *  nothing due — otherwise the base email's own subject (about what's due
 *  tomorrow) stays exactly as Wanderlist built it. */
export function marqueeOnlySubject(changes) {
  if (changes.length === 1) return `Marquee: “${changes[0].title}” — ${CHANGE_LABEL[changes[0].kind]}`
  const opened = changes.filter((c) => c.kind === CHANGE.TICKETS_OPENED).length
  return opened > 0
    ? `Marquee: ${opened} tickets just opened`
    : `Marquee: ${changes.length} changes at your venues`
}

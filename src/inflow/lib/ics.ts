/**
 * A calendar reminder for an expected payment's due date: one all-day event, as an .ics file the
 * phone or computer's own calendar opens. Nothing is sent anywhere; the file is the whole of it.
 */
import type { IncomeRecord } from '../domain/types'
import { money } from './money'

/** RFC 5545 text: backslash, semicolon, comma and line breaks escaped. */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const day = (d: string) => d.replace(/-/g, '')
const nextDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}
/** Lines longer than 75 octets are folded, as the format asks. */
const fold = (line: string) => {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}` }
  out.push(rest)
  return out.join('\r\n')
}

export function reminderIcs(r: Pick<IncomeRecord, 'id' | 'description' | 'amount' | 'currency' | 'date' | 'notes'>, from: string | null, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const what = `${money(r.amount, r.currency)} due${from ? ` from ${from}` : ''}`
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InFlow//Expected payment//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:inflow-${r.id || 'new'}-${day(r.date)}@inflow`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day(r.date)}`,
    `DTEND;VALUE=DATE:${day(nextDay(r.date))}`,
    `SUMMARY:${text(`${what}: ${r.description}`)}`,
    `DESCRIPTION:${text(`Expected payment in InFlow. Mark it received when it arrives.${r.notes ? `\n${r.notes}` : ''}`)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(what)}`, 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n'
}

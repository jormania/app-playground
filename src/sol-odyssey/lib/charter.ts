// The Charter: pure logic that turns a draft into a valid, activatable Odyssey and into the
// Notion properties we write. No React, no network — all unit-tested.

import type { Settings } from './settings'

/** Everything the wizard collects. Buddy fields are NOT here — they live in Settings and are
 *  folded into the row at write time (spec: buddy = name + email, captured once). */
export interface CharterDraft {
  behaviour: string
  outcomePicture: string
  identity: string
  tinyVersion: string
  anchor: string
  ifThen: string
  pairing: string // optional
  dailySuccess: string
  whyValue: string
  startDate: string // ISO yyyy-mm-dd
  confirmedShrink: boolean // the "would you bet €50?" gate
}

export const CYCLE_DAYS = 42

export function emptyDraft(today = new Date(), startDate = defaultStartDate(today)): CharterDraft {
  return {
    behaviour: '',
    outcomePicture: '',
    identity: '',
    tinyVersion: '',
    anchor: '',
    ifThen: '',
    pairing: '',
    dailySuccess: '',
    whyValue: '',
    startDate,
    confirmedShrink: false,
  }
}

/** Required text fields (pairing is intentionally optional). */
export const REQUIRED_FIELDS: (keyof CharterDraft)[] = [
  'behaviour',
  'outcomePicture',
  'identity',
  'tinyVersion',
  'anchor',
  'ifThen',
  'dailySuccess',
  'whyValue',
]

/** A value is "specific" if it's more than a single word and not trivially short — the guard
 *  against vague behaviours, the #1 first-week failure. */
export function isSpecific(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= 8 && trimmed.split(/\s+/).length >= 2
}

/** Field-level validation messages for the whole draft (empty when valid). */
export function charterErrors(draft: CharterDraft): Partial<Record<keyof CharterDraft, string>> {
  const errors: Partial<Record<keyof CharterDraft, string>> = {}
  for (const field of REQUIRED_FIELDS) {
    if (!String(draft[field]).trim()) errors[field] = 'This one’s needed to keep the Odyssey honest.'
  }
  if (draft.tinyVersion.trim() && !isSpecific(draft.tinyVersion)) {
    errors.tinyVersion = 'Make it concrete — what exactly do you do, in a couple of words at least?'
  }
  if (draft.anchor.trim() && !isSpecific(draft.anchor)) {
    errors.anchor = 'Name the existing habit it attaches to, specifically.'
  }
  if (!draft.startDate) errors.startDate = 'Pick a start date.'
  return errors
}

/** True once every required field is valid AND the shrink gate is affirmed. */
export function canActivate(draft: CharterDraft): boolean {
  return Object.keys(charterErrors(draft)).length === 0 && draft.confirmedShrink === true
}

/** Given the wizard's ordered field keys, the index of the first step still needing input (an
 *  empty/invalid required field) — i.e. where to resume a saved draft. Returns `stepKeys.length`
 *  (the review step) when the charter is already complete. Empty optional fields are skipped. */
export function firstIncompleteStep(draft: CharterDraft, stepKeys: (keyof CharterDraft)[]): number {
  const errors = charterErrors(draft)
  for (let i = 0; i < stepKeys.length; i++) {
    if (errors[stepKeys[i]]) return i
  }
  return stepKeys.length
}

// ── Dates (date-only, no timezone drift) ──────────────────────────────────────────────────

function fmt(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

const DOW_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

/** A meaningful Day 1 from the user's preference: `'today'`, or a weekday (`'mon'`…`'sun'`) meaning
 *  the next occurrence of that day (today if it's already that day). Defaults to next Monday. */
export function defaultStartDate(today = new Date(), pref = 'mon'): string {
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  if (pref === 'today') return fmt(base)
  const target = DOW_INDEX[pref] ?? 1
  const add = (target - base.getUTCDay() + 7) % 7
  base.setUTCDate(base.getUTCDate() + add)
  return fmt(base)
}

/** End Date = Start + 41 days (42-day inclusive cycle). */
export function computeEndDate(startISO: string): string {
  const d = parseUTC(startISO)
  d.setUTCDate(d.getUTCDate() + (CYCLE_DAYS - 1))
  return fmt(d)
}

/** 1-based day number within the cycle for `today` (can read <1 before start, >42 after). */
export function computeDayIndex(startISO: string, today = new Date()): number {
  const start = parseUTC(startISO).getTime()
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((now - start) / 86400000) + 1
}

/** Local calendar date as ISO `yyyy-mm-dd` (no timezone drift). */
export function todayISO(today = new Date()): string {
  return fmt(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())))
}

/** `iso` shifted by `n` days (negative = back), returned as `yyyy-mm-dd`. */
export function isoAddDays(iso: string, n: number): string {
  const d = parseUTC(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

// ── Numbering & naming ────────────────────────────────────────────────────────────────────

export function nextOdysseyNumber(maxExisting: number | null): number {
  return maxExisting && maxExisting > 0 ? maxExisting + 1 : 1
}

/** e.g. "Odyssey 1 — morning movement" (behaviour trimmed to a short tail). Latin numerals. */
export function odysseyName(number: number, behaviour: string): string {
  const tail = behaviour.trim().replace(/\s+/g, ' ').slice(0, 60)
  return tail ? `Odyssey ${number} — ${tail}` : `Odyssey ${number}`
}

// ── Notion property mapping ───────────────────────────────────────────────────────────────

function richText(value: string): { rich_text: { text: { content: string } }[] } {
  const v = value.trim()
  return { rich_text: v ? [{ text: { content: v } }] : [] }
}

/** The charter fields shared by both the Active and the Planning (draft) property maps. */
function charterFieldProperties(draft: CharterDraft, settings: Settings): Record<string, unknown> {
  return {
    Behaviour: richText(draft.behaviour),
    'Identity Statement': richText(draft.identity),
    'Tiny Version': richText(draft.tinyVersion),
    Anchor: richText(draft.anchor),
    'If-Then': richText(draft.ifThen),
    'Outcome Picture': richText(draft.outcomePicture),
    Pairing: richText(draft.pairing),
    'Daily Success': richText(draft.dailySuccess),
    'Why / Value': richText(draft.whyValue),
    'Buddy Name': richText(settings.buddyName),
    'Buddy Channel': richText(settings.buddyEmail),
    'Daily Reminder Time': richText(settings.dailyTime),
    'Weekly Call Slot': richText(settings.weeklySlot),
  }
}

/** Build the Notion `properties` object for a new Active Odyssey row (also used to PATCH a
 *  Planning draft into Active at activation — it sets Status + the assigned number). */
export function buildCreateOdysseyProperties(
  draft: CharterDraft,
  settings: Settings,
  number: number,
): Record<string, unknown> {
  return {
    Name: { title: [{ text: { content: odysseyName(number, draft.behaviour) } }] },
    'Odyssey Number': { number },
    Status: { select: { name: 'Active' } },
    'Start Date': { date: { start: draft.startDate } },
    'End Date': { date: { start: computeEndDate(draft.startDate) } },
    ...charterFieldProperties(draft, settings),
  }
}

/** Build the Notion `properties` for a Planning (draft) Odyssey row. Unlike the Active map it
 *  carries NO `Odyssey Number` (assigned at activation, so an abandoned draft never burns one)
 *  and only writes the dates when a start date is set. Partial drafts are fine — `richText()`
 *  tolerates empty values. The title falls back to the unnumbered behaviour tail. */
export function buildDraftOdysseyProperties(
  draft: CharterDraft,
  settings: Settings,
): Record<string, unknown> {
  const tail = draft.behaviour.trim().replace(/\s+/g, ' ').slice(0, 60)
  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: tail || 'Planned Odyssey' } }] },
    Status: { select: { name: 'Planning' } },
    ...charterFieldProperties(draft, settings),
  }
  if (draft.startDate) {
    props['Start Date'] = { date: { start: draft.startDate } }
    props['End Date'] = { date: { start: computeEndDate(draft.startDate) } }
  }
  return props
}

/** Map a Planning row (read back from Notion) into a CharterDraft so the wizard can resume.
 *  `confirmedShrink` is a gate, not a stored field — it resets so the user re-affirms before
 *  beginning. */
export function parseDraftToCharter(
  detail: {
    behaviour: string
    outcomePicture: string
    identity: string
    tinyVersion: string
    anchor: string
    ifThen: string
    pairing: string
    dailySuccess: string
    whyValue: string
    startDate: string
  },
  today = new Date(),
): CharterDraft {
  return {
    behaviour: detail.behaviour,
    outcomePicture: detail.outcomePicture,
    identity: detail.identity,
    tinyVersion: detail.tinyVersion,
    anchor: detail.anchor,
    ifThen: detail.ifThen,
    pairing: detail.pairing,
    dailySuccess: detail.dailySuccess,
    whyValue: detail.whyValue,
    startDate: detail.startDate || defaultStartDate(today),
    confirmedShrink: false,
  }
}

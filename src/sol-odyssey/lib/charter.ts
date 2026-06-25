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

export function emptyDraft(today = new Date()): CharterDraft {
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
    startDate: defaultStartDate(today),
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

/** The next Monday on/after `today` — a meaningful Day 1 (today if it's already Monday). */
export function defaultStartDate(today = new Date()): string {
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const dow = base.getUTCDay() // 0 Sun … 1 Mon
  const add = (1 - dow + 7) % 7
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

/** Build the Notion `properties` object for a new Active Odyssey row. */
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

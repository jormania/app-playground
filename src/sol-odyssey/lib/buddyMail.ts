// Buddy emails as *structured content*, not mailto strings. Each builder returns a heading,
// greeting, intro, labelled sections, and an outro — the app renders that into clean,
// email-safe HTML (inline CSS + Unicode emojis, no SVGs/images) which the user copies to the
// clipboard and pastes into Gmail's compose window (see components/BuddyEmailButton.tsx).
// The app still sends nothing itself.
//
// Field-by-field explanations meant for the buddy do NOT live in these per-event emails — they
// live once, in the welcome package (buddyWelcomeEmail), so the recurring notes stay clean.

import type { OdysseyDetail } from './notion'
import type { CheckinDraft } from './checkins'
import type { ReflectionDraft } from './reflections'

/** One labelled line in an email: an emoji accent, a label, and its value. */
export interface EmailRow {
  emoji: string
  label: string
  value: string
}

/** A block of rows, optionally titled (the welcome package uses several titled blocks; the
 *  recurring emails use a single untitled one). */
export interface EmailSection {
  title?: string
  rows: EmailRow[]
}

/** A fully-structured buddy email, ready to render to HTML + plain text. */
export interface BuddyEmail {
  subject: string
  heading: string
  greeting: string
  intro: string
  sections: EmailSection[]
  outro: string
}

function odysseyLabel(number: number | null): string {
  return number != null ? `Odyssey ${number}` : 'a new Odyssey'
}
function greeting(buddyName: string): string {
  const n = clean(buddyName)
  return n ? `Dear ${n},` : 'Hello,'
}
function clean(s: string): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}
/** Append the runner's name to a subject, so the buddy sees at a glance who it's from. */
function withUser(subject: string, userName: string): string {
  const u = clean(userName)
  return u ? `${subject} · ${u}` : subject
}
/** Keep only the rows that have a value (lets optional fields drop out cleanly). */
function rows(...items: (EmailRow | undefined | false)[]): EmailRow[] {
  return items.filter((r): r is EmailRow => Boolean(r))
}
/** An optional row: present only when its value is non-empty. */
function opt(emoji: string, label: string, value: string): EmailRow | undefined {
  const v = clean(value)
  return v ? { emoji, label, value: v } : undefined
}

/** The daily check-in note. */
export function dailyBuddyMail(
  buddyName: string,
  userName: string,
  odyssey: OdysseyDetail,
  checkin: CheckinDraft,
  dayIndex: number,
): BuddyEmail {
  return {
    subject: withUser(`Sol Odyssey · ${odysseyLabel(odyssey.number)} · Day ${dayIndex} check-in`, userName),
    heading: `📅 Day ${dayIndex} check-in`,
    greeting: greeting(buddyName),
    intro: `My daily check-in — day ${dayIndex} of 42, building one small habit, one day at a time.`,
    sections: [
      {
        rows: rows(
          { emoji: '🎯', label: 'The habit', value: clean(odyssey.behaviour) || '—' },
          { emoji: checkin.done ? '✅' : '⬜', label: 'Did it today', value: checkin.done ? 'Yes' : 'Not yet' },
          { emoji: '📝', label: 'One line', value: clean(checkin.oneLine) || '—' },
          opt('🪨', 'What got in the way', checkin.friction),
        ),
      },
    ],
    outro: "There's nothing you need to do with this — just knowing you've seen it helps more than you'd think.",
  }
}

/** The weekly reflection, for the weekly call. */
export function weeklyBuddyMail(
  buddyName: string,
  userName: string,
  odyssey: OdysseyDetail,
  draft: ReflectionDraft,
  week: number,
  /** The new tiny version, ONLY when the runner actually applied it this week — surfaces the change
   *  to the witness so the daily practice they're tracking stays accurate. Omitted otherwise. */
  newTinyVersion?: string,
): BuddyEmail {
  return {
    subject: withUser(`Sol Odyssey · ${odysseyLabel(odyssey.number)} · Week ${week} reflection`, userName),
    heading: `🗓️ Week ${week} reflection`,
    greeting: greeting(buddyName),
    intro: `My weekly reflection — a look back at week ${week} of my 42-day Odyssey, for our check-in.`,
    sections: [
      {
        rows: rows(
          { emoji: '🎯', label: 'The habit', value: clean(odyssey.behaviour) || '—' },
          { emoji: '✅', label: 'Days done', value: `${draft.daysDone} / 7` },
          { emoji: '🪨', label: 'Where it slipped', value: clean(draft.breakPoints) || '—' },
          { emoji: '📐', label: 'How it felt', value: clean(draft.fit) || '—' },
          { emoji: '🔧', label: 'One change next week', value: clean(draft.oneAdjustment) || '—' },
          opt('🌱', 'New tiny version (from now on)', newTinyVersion ?? ''),
          { emoji: '🌡️', label: 'How installed it feels', value: `${draft.temperature} / 10` },
          opt('⚠️', 'Riskiest moment next week', draft.riskPlan),
        ),
      },
    ],
    outro: "No advice needed — honestly, just having you listen means a lot.",
  }
}

/** The kickoff: announce a new Odyssey, share the charter, ask them to witness. */
export function kickoffBuddyMail(buddyName: string, userName: string, odyssey: OdysseyDetail): BuddyEmail {
  const hasRuns = Boolean(odyssey.startDate && odyssey.endDate)
  return {
    subject: withUser(`Sol Odyssey · ${odysseyLabel(odyssey.number)} · will you witness?`, userName),
    heading: '🚀 Starting a new Odyssey — will you witness?',
    greeting: greeting(buddyName),
    intro:
      "I'm about to start a 42-day stretch of practising one small habit every day, and I'd love you as my witness. Here's the plan.",
    sections: [
      {
        rows: rows(
          { emoji: '🎯', label: "The habit I'm installing", value: clean(odyssey.behaviour) || '—' },
          opt('🧭', "Who I'm becoming", odyssey.identity),
          opt('🌱', 'The tiny version', odyssey.tinyVersion),
          opt('✅', 'What counts as done', odyssey.dailySuccess),
          hasRuns ? { emoji: '📆', label: 'When it runs', value: `${odyssey.startDate} to ${odyssey.endDate}` } : undefined,
        ),
      },
    ],
    outro:
      "The welcome note I'll send lays out what it would involve for you — a short note from me most days and a ten-minute call once a week — and there's no need to run an Odyssey of your own.",
  }
}

/** The harvest: tell your buddy what installed + the outcome. */
export function harvestBuddyMail(buddyName: string, userName: string, odyssey: OdysseyDetail): BuddyEmail {
  return {
    subject: withUser(`Sol Odyssey · ${odysseyLabel(odyssey.number)} · harvested`, userName),
    heading: '🌅 Harvest — 42 days done',
    greeting: greeting(buddyName),
    intro: "I just finished my 42-day run — here's how it landed. Thank you for witnessing it.",
    sections: [
      {
        rows: rows(
          { emoji: '🎯', label: 'The habit', value: clean(odyssey.behaviour) || '—' },
          { emoji: '✨', label: 'What installed', value: clean(odyssey.notes) || '—' },
          opt('🔭', 'Where it goes next', odyssey.outcome),
        ),
      },
    ],
    outro: "I couldn't have done it the same way without you.",
  }
}

/** The welcome package: a one-time onboarding letter the runner sends when recruiting a buddy.
 *  It carries everything the buddy should understand — the Odyssey itself, what they'll receive,
 *  what's asked of them, and how to read the recurring notes (the explanations stripped from the
 *  per-event emails live here). */
export function buddyWelcomeEmail(buddyName: string, userName: string): BuddyEmail {
  const u = clean(userName)
  return {
    subject: withUser('Sol Odyssey · An invitation to be my witness', userName),
    heading: '👋 Will you be my witness?',
    greeting: greeting(buddyName),
    intro:
      "I'm starting something called an Odyssey: 42 days of practising one small habit every day until it sticks. It works far better with one person witnessing it — and I'd love that to be you. Here's everything it involves; none of it needs a reply.",
    sections: [
      {
        title: '🧭 What an Odyssey is',
        rows: [
          { emoji: '🎯', label: 'One habit', value: 'A single small action, repeated daily for 42 days.' },
          { emoji: '🌱', label: 'Kept tiny', value: "Small enough to do on the worst day — showing up beats intensity." },
          { emoji: '📈', label: 'Adjusted weekly', value: 'Once a week I look back and change just one thing.' },
        ],
      },
      {
        title: "📬 What you'll receive",
        rows: [
          { emoji: '🚀', label: 'A kickoff', value: "Once, at the start — the plan for the 42 days. A “yes, I'm in” is all I need." },
          { emoji: '📅', label: 'A daily note', value: 'A short check-in most days. No reply needed — being read is the point.' },
          { emoji: '🗓️', label: 'A weekly call', value: 'About 10 minutes once a week to talk it through.' },
          { emoji: '🌅', label: 'A harvest note', value: 'Once, at day 42 — how it all landed.' },
        ],
      },
      {
        title: '🤝 All I hope for',
        rows: [
          { emoji: '👂', label: 'Witnessing, not fixing', value: "You don't have to solve anything — just being there is what helps." },
          { emoji: '💛', label: 'A little curiosity', value: 'A gentle question helps far more than judgment, especially on the days I slip.' },
          { emoji: '🔒', label: 'Just between us', value: 'It would mean a lot to keep this private to the two of us.' },
        ],
      },
      {
        title: '🔎 Reading my notes',
        rows: [
          { emoji: '✅', label: '“Did it today”', value: 'Just showing up counts — the tiny version is a real yes.' },
          { emoji: '📝', label: '“One line”', value: 'A sentence on what happened, or what I noticed.' },
          { emoji: '🌡️', label: '“How installed it feels”', value: '1 = still effortful, 10 = automatic. Watch the drift, not the number.' },
          { emoji: '📐', label: '“How it felt”', value: 'Whether the habit was too big, too vague, or about right.' },
        ],
      },
    ],
    outro: `That's the whole of it. If you're in, just reply — it would mean a lot to have you along.${u ? ` Thank you, ${u}.` : ' Thank you.'}`,
  }
}

/** Gmail's compose handler. `to` + `su` (subject) are pre-filled; the rich note travels via the
 *  clipboard (the compose URL can't carry formatted HTML), so an optional plain-text `body` seeds
 *  the draft with a paste reminder the user replaces. */
export function gmailComposeUrl(to: string, subject: string, body?: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to: to.trim(), su: subject })
  if (body) params.set('body', body)
  return `https://mail.google.com/mail/?${params.toString()}`
}

/** Seeded into the Gmail draft body as a reminder; the user pastes over it. */
export const PASTE_REMINDER =
  '⬇️ Paste here (Ctrl+V / ⌘+V) — your formatted note is already on the clipboard. Then delete this line and send.'

/** Deterministic plain-text rendering of an email — the `text/plain` clipboard flavour.
 *  Derived from the structured model (not the DOM's `.innerText`), so it's layout-independent,
 *  works even when the HTML template is `display:none`, and is unit-testable. */
export function emailToPlainText(email: BuddyEmail): string {
  const out: string[] = [email.heading, '', email.greeting, email.intro, '']
  for (const section of email.sections) {
    if (section.title) out.push(section.title)
    for (const r of section.rows) out.push(`${r.emoji} ${r.label}: ${r.value}`)
    out.push('')
  }
  out.push(email.outro, '', 'Sent with Sol Odyssey')
  return out.join('\n')
}

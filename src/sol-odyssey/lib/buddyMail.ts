// Draft buddy emails via mailto: the app builds a subject + a tight, structured plain-text body
// (pulled from the Odyssey, with a space up top for the user's own note) and hands it to the user's
// own mail client. The app sends nothing itself. Bodies are kept ASCII-clean and short so they
// survive every mail client, desktop and mobile (the Gmail app, iOS Mail, …) without mangling.

import type { OdysseyDetail } from './notion'
import type { CheckinDraft } from './checkins'
import type { ReflectionDraft } from './reflections'

export interface BuddyMail {
  subject: string
  body: string
}

function odysseyLabel(number: number | null): string {
  return number != null ? `Odyssey ${number}` : 'a new Odyssey'
}
function greeting(name: string): string {
  const n = name.trim()
  return n ? `Dear ${n},` : 'Hello,'
}
/** Join non-empty lines with CRLF (the newline both iOS and Android mail clients parse cleanly). */
function body(...lines: (string | false | null | undefined)[]): string {
  return lines.filter((l): l is string => typeof l === 'string').join('\r\n')
}
function clean(s: string): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/** The daily check-in note. */
export function dailyBuddyMail(
  name: string,
  odyssey: OdysseyDetail,
  checkin: CheckinDraft,
  dayIndex: number,
): BuddyMail {
  return {
    subject: `Sol Odyssey · ${odysseyLabel(odyssey.number)} · Day ${dayIndex} check-in`,
    body: body(
      greeting(name),
      '',
      `My daily check-in - day ${dayIndex} of 42, building one small habit a bit at a time.`,
      '',
      `The habit: ${clean(odyssey.behaviour) || '-'}`,
      `Did it today? ${checkin.done ? 'Yes' : 'Not yet'}  (just showing up is the win)`,
      `One line: ${clean(checkin.oneLine) || '-'}  (what happened, or what I noticed)`,
      clean(checkin.friction) ? `What got in the way: ${clean(checkin.friction)}` : undefined,
      '',
      "Nothing to fix on your end - being witnessed is what helps.",
    ),
  }
}

/** The weekly reflection, for the weekly call. */
export function weeklyBuddyMail(
  name: string,
  odyssey: OdysseyDetail,
  draft: ReflectionDraft,
  week: number,
): BuddyMail {
  return {
    subject: `Sol Odyssey · ${odysseyLabel(odyssey.number)} · Week ${week} reflection`,
    body: body(
      greeting(name),
      '',
      `My weekly reflection - a look back at week ${week} of this 42-day habit, for our check-in.`,
      '',
      `The habit: ${clean(odyssey.behaviour) || '-'}`,
      `Days done: ${draft.daysDone} / 7  (days I managed it)`,
      `Where it slipped: ${clean(draft.breakPoints) || '-'}  (moments it did not happen)`,
      `How it felt: ${clean(draft.fit) || '-'}  (too big, too vague, or about right)`,
      `One change next week: ${clean(draft.oneAdjustment) || '-'}  (the single thing I will adjust)`,
      `How installed it feels: ${draft.temperature} / 10  (1 = effortful, 10 = automatic)`,
      clean(draft.riskPlan) ? `Riskiest moment next week: ${clean(draft.riskPlan)}` : undefined,
      '',
      "Just listen and stay curious - that is the whole job.",
    ),
  }
}

/** The kickoff: announce a new Odyssey, share the charter, ask them to witness. */
export function kickoffBuddyMail(name: string, odyssey: OdysseyDetail): BuddyMail {
  const hasRuns = Boolean(odyssey.startDate && odyssey.endDate)
  return {
    subject: `Sol Odyssey · ${odysseyLabel(odyssey.number)} · will you witness?`,
    body: body(
      greeting(name),
      '',
      "I'm about to start a 42-day stretch of practising one small habit every day, and I'd love you as my witness. Here's the plan, and what I'd be asking of you.",
      '',
      `The habit I'm installing: ${clean(odyssey.behaviour) || '-'}`,
      clean(odyssey.identity) ? `Who I'm becoming: ${clean(odyssey.identity)}  (the kind of person this builds)` : undefined,
      clean(odyssey.tinyVersion) ? `The tiny version: ${clean(odyssey.tinyVersion)}  (so small I can't fail on a bad day)` : undefined,
      clean(odyssey.dailySuccess) ? `What counts as done: ${clean(odyssey.dailySuccess)}` : undefined,
      hasRuns ? `When it runs: ${odyssey.startDate} to ${odyssey.endDate}` : undefined,
      '',
      'Being my witness is light: a short note from me each day, and a ~10-minute call once a week.',
      "Three small asks - witness don't fix, stay curious (no judgment), and keep it between us. No need to run one yourself.",
    ),
  }
}

function outcomeGloss(outcome: string): string {
  if (outcome === 'Keep') return '(keeping it at its tiny floor)'
  if (outcome === 'Grow') return '(growing it next cycle)'
  if (outcome === 'Retire') return '(retiring it, its work done)'
  return ''
}

/** The harvest: tell your buddy what installed + the outcome. */
export function harvestBuddyMail(name: string, odyssey: OdysseyDetail): BuddyMail {
  const gloss = outcomeGloss(odyssey.outcome)
  return {
    subject: `Sol Odyssey · ${odysseyLabel(odyssey.number)} · harvested`,
    body: body(
      greeting(name),
      '',
      "I just finished my 42-day run - here's how it landed. Thank you for witnessing it.",
      '',
      `The habit: ${clean(odyssey.behaviour) || '-'}`,
      `What installed: ${clean(odyssey.notes) || '-'}  (how it feels now)`,
      odyssey.outcome ? `Where it goes next: ${odyssey.outcome}${gloss ? ' ' + gloss : ''}  (keep / grow / retire)` : undefined,
      '',
      "I couldn't have done it the same way without you.",
    ),
  }
}

/** Build a mailto: URL. The address is left as-is (a raw @ is valid in mailto); subject + body are
 *  percent-encoded (CRLF → %0D%0A). */
export function buildMailtoUrl(to: string, mail: BuddyMail): string {
  const query = `subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`
  return `mailto:${to.trim()}?${query}`
}

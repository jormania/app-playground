import { describe, it, expect } from 'vitest'
import {
  dailyBuddyMail,
  weeklyBuddyMail,
  kickoffBuddyMail,
  harvestBuddyMail,
  buddyWelcomeEmail,
  gmailComposeUrl,
  outlookComposeUrl,
  mailtoUrl,
  composeTarget,
  emailToPlainText,
  formatDateRange,
  type BuddyEmail,
} from './buddyMail'
import type { OdysseyDetail } from './notion'
import { EMPTY_CHECKIN } from './checkins'
import { EMPTY_REFLECTION } from './reflections'

function odyssey(over: Partial<OdysseyDetail> = {}): OdysseyDetail {
  return {
    id: 'o1',
    title: 'Odyssey 3 — morning movement',
    number: 3,
    status: 'Active',
    startDate: '2026-07-06',
    endDate: '2026-08-16',
    behaviour: 'Move my body before the day takes me',
    identity: 'I am someone who starts the day in motion',
    tinyVersion: 'walk to the corner',
    anchor: 'after my first coffee',
    ifThen: 'if it rains, hallway',
    outcomePicture: 'a steadier mind',
    pairing: '',
    dailySuccess: 'shoes on, outside',
    whyValue: 'a body in motion',
    commitment: '',
    outcome: '',
    notes: '',
    ...over,
  }
}

/** Flatten every row value across an email — handy for "does it mention X" assertions. */
function rowText(mail: BuddyEmail): string {
  return mail.sections.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`)).join(' | ')
}

describe('dailyBuddyMail', () => {
  it('names the Odyssey + day, includes the runner in the subject, and recaps the check-in', () => {
    const mail = dailyBuddyMail('Sam', 'Alex', odyssey(), { ...EMPTY_CHECKIN, done: true, oneLine: 'made it round the block' }, 12)
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · Day 12 check-in · Alex')
    expect(mail.greeting).toBe('Dear Sam,')
    expect(mail.intro).toContain('day 12 of 42')
    expect(rowText(mail)).toContain('Did it today: Yes')
    expect(rowText(mail)).toContain('One line: made it round the block')
  })
  it('omits the runner suffix when no name is set', () => {
    const mail = dailyBuddyMail('Sam', '', odyssey(), { ...EMPTY_CHECKIN }, 1)
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · Day 1 check-in')
  })
  it('omits friction when empty, includes it when present', () => {
    expect(rowText(dailyBuddyMail('Sam', 'Alex', odyssey(), { ...EMPTY_CHECKIN, oneLine: 'x' }, 1))).not.toContain('What got in the way')
    expect(rowText(dailyBuddyMail('Sam', 'Alex', odyssey(), { ...EMPTY_CHECKIN, oneLine: 'x', friction: 'tired' }, 1))).toContain('What got in the way: tired')
  })
  it('carries no buddy-facing field explanations in the recurring note', () => {
    const text = emailToPlainText(dailyBuddyMail('Sam', 'Alex', odyssey(), { ...EMPTY_CHECKIN, oneLine: 'x' }, 1))
    expect(text).not.toContain('just showing up is the win')
    expect(text).not.toContain('what happened, or what I noticed')
  })
})

describe('weeklyBuddyMail', () => {
  it('lists the answers for the week', () => {
    const draft = { ...EMPTY_REFLECTION, daysDone: 5, fit: 'About right' as const, oneAdjustment: 'walk earlier', temperature: 6 }
    const mail = weeklyBuddyMail('Sam', 'Alex', odyssey(), draft, 2)
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · Week 2 reflection · Alex')
    const text = rowText(mail)
    expect(text).toContain('Days done: 5 / 7')
    expect(text).toContain('How it felt: About right')
    expect(text).toContain('One change next week: walk earlier')
    expect(text).toContain('How installed it feels: 6 / 10')
  })
  it('omits the new-tiny-version row unless one was applied this week', () => {
    const draft = { ...EMPTY_REFLECTION, oneAdjustment: 'walk earlier' }
    expect(rowText(weeklyBuddyMail('Sam', 'Alex', odyssey(), draft, 2))).not.toContain('New tiny version')
    expect(rowText(weeklyBuddyMail('Sam', 'Alex', odyssey(), draft, 2, '   '))).not.toContain('New tiny version')
    expect(rowText(weeklyBuddyMail('Sam', 'Alex', odyssey(), draft, 2, 'walk to the mailbox'))).toContain(
      'New tiny version (from now on): walk to the mailbox',
    )
  })
})

describe('kickoffBuddyMail', () => {
  it('shares the charter and asks them to witness', () => {
    const mail = kickoffBuddyMail('Sam', 'Alex', odyssey())
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · will you witness? · Alex')
    expect(rowText(mail)).toContain("The habit I'm installing: Move my body before the day takes me")
    expect(rowText(mail)).toContain('When it runs: 6 Jul – 16 Aug 2026')
    expect(`${mail.heading} ${mail.intro} ${mail.outro}`.toLowerCase()).toContain('witness')
  })
  it('falls back to "a new Odyssey" when a draft has no number', () => {
    const mail = kickoffBuddyMail('Sam', 'Alex', odyssey({ number: null }))
    expect(mail.subject).toContain('a new Odyssey')
  })
})

describe('harvestBuddyMail', () => {
  it('states what installed + the outcome', () => {
    const mail = harvestBuddyMail('Sam', 'Alex', odyssey({ notes: 'feels automatic now', outcome: 'Keep' }))
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · harvested · Alex')
    expect(rowText(mail)).toContain('What installed: feels automatic now')
    expect(rowText(mail)).toContain('Where it goes next: Keep')
  })
  it('omits the pass-it-on row unless one is written', () => {
    expect(rowText(harvestBuddyMail('Sam', 'Alex', odyssey()))).not.toContain('Something to pass on')
    expect(rowText(harvestBuddyMail('Sam', 'Alex', odyssey(), '   '))).not.toContain('Something to pass on')
    expect(rowText(harvestBuddyMail('Sam', 'Alex', odyssey(), 'start smaller than you think'))).toContain(
      'Something to pass on: start smaller than you think',
    )
  })
})

describe('buddyWelcomeEmail', () => {
  it('greets the buddy, signs off with the runner, and carries the field explanations', () => {
    const mail = buddyWelcomeEmail('Sam', 'Alex')
    expect(mail.greeting).toBe('Dear Sam,')
    expect(mail.outro).toContain('Alex')
    const text = emailToPlainText(mail)
    expect(text).toContain('1 = still effortful, 10 = automatic')
    expect(text).toContain('A weekly call')
  })
  it('glosses fields for all four event emails, not just the daily note', () => {
    const text = emailToPlainText(buddyWelcomeEmail('Sam', 'Alex'))
    expect(text).toContain('Reading the kickoff')
    expect(text).toContain('“Who I’m becoming”')
    expect(text).toContain('Reading the daily note')
    expect(text).toContain('“What got in the way”')
    expect(text).toContain('Reading the weekly reflection')
    expect(text).toContain('“Riskiest moment next week”')
    expect(text).toContain('Reading the harvest note')
    expect(text).toContain('“Something to pass on”')
  })
  it('carries all four ground rules from the guide', () => {
    const text = emailToPlainText(buddyWelcomeEmail('Sam', 'Alex'))
    expect(text).toContain('Witnessing, not fixing')
    expect(text).toContain('Curiosity, never judgment')
    expect(text).toContain('Just between us')
    expect(text).toContain('No pressure to keep pace')
  })
})

describe('formatDateRange', () => {
  it('collapses a shared year and uses an en dash', () => {
    expect(formatDateRange('2026-07-06', '2026-08-16')).toBe('6 Jul – 16 Aug 2026')
  })
  it('keeps both years across a year boundary', () => {
    expect(formatDateRange('2026-12-28', '2027-02-05')).toBe('28 Dec 2026 – 5 Feb 2027')
  })
  it('falls back to raw ISO when unparseable', () => {
    expect(formatDateRange('nope', '2027-02-05')).toBe('nope to 2027-02-05')
  })
})

describe('gmailComposeUrl', () => {
  it('targets the compose handler with encoded recipient + subject', () => {
    const url = gmailComposeUrl('sam@example.com', 'Sol Odyssey · Day 1 · Alex')
    expect(url.startsWith('https://mail.google.com/mail/?')).toBe(true)
    expect(url).toContain('view=cm')
    expect(url).toContain('fs=1')
    expect(url).toContain('to=sam%40example.com')
    expect(url).toContain('su=Sol+Odyssey+%C2%B7+Day+1+%C2%B7+Alex')
    expect(url).not.toContain('body=')
  })
  it('seeds the draft body only when one is given', () => {
    expect(gmailComposeUrl('sam@example.com', 'S', 'paste here')).toContain('body=paste+here')
  })
})

describe('mailtoUrl', () => {
  it('targets the address and encodes subject + body with %20 (not +)', () => {
    const url = mailtoUrl('sam@example.com', 'Sol Odyssey · Day 1', 'paste here')
    expect(url.startsWith('mailto:sam@example.com?')).toBe(true)
    expect(url).toContain('subject=Sol%20Odyssey%20%C2%B7%20Day%201')
    expect(url).toContain('body=paste%20here')
    expect(url).not.toContain('+')
  })
  it('omits the body when none is given', () => {
    expect(mailtoUrl('sam@example.com', 'S')).toBe('mailto:sam@example.com?subject=S')
  })
})

describe('outlookComposeUrl', () => {
  it('targets the Outlook deep link with to + subject', () => {
    const url = outlookComposeUrl('sam@example.com', 'Hello there')
    expect(url.startsWith('https://outlook.office.com/mail/deeplink/compose?')).toBe(true)
    expect(url).toContain('to=sam%40example.com')
    expect(url).toContain('subject=Hello+there')
  })
})

describe('composeTarget', () => {
  it('always uses mailto on mobile, whatever the provider', () => {
    for (const p of ['default', 'gmail', 'outlook'] as const) {
      const t = composeTarget(p, true, 'sam@example.com', 'S', 'b')
      expect(t.viaLocation).toBe(true)
      expect(t.url.startsWith('mailto:')).toBe(true)
    }
  })
  it('on desktop honours the provider choice', () => {
    expect(composeTarget('gmail', false, 'sam@example.com', 'S').url).toContain('mail.google.com')
    expect(composeTarget('outlook', false, 'sam@example.com', 'S').url).toContain('outlook.office.com')
    expect(composeTarget('default', false, 'sam@example.com', 'S')).toEqual({
      url: 'mailto:sam@example.com?subject=S',
      viaLocation: true,
    })
  })
  it('marks webmail targets as new-tab (not location)', () => {
    expect(composeTarget('gmail', false, 'sam@example.com', 'S').viaLocation).toBe(false)
    expect(composeTarget('outlook', false, 'sam@example.com', 'S').viaLocation).toBe(false)
  })
})

describe('emailToPlainText', () => {
  it('renders heading, greeting, labelled rows and the sign-off', () => {
    const text = emailToPlainText(dailyBuddyMail('Sam', 'Alex', odyssey(), { ...EMPTY_CHECKIN, done: true, oneLine: 'walked' }, 4))
    expect(text).toContain('📅 Day 4 check-in')
    expect(text).toContain('Dear Sam,')
    expect(text).toContain('🎯 The habit: Move my body before the day takes me')
    expect(text.trim().endsWith('Sent with Sol Odyssey')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import {
  dailyBuddyMail,
  weeklyBuddyMail,
  kickoffBuddyMail,
  harvestBuddyMail,
  buildMailtoUrl,
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

describe('dailyBuddyMail', () => {
  it('names the Odyssey + day in the subject and recaps the check-in', () => {
    const mail = dailyBuddyMail('Sam', odyssey(), { ...EMPTY_CHECKIN, done: true, oneLine: 'made it round the block' }, 12)
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · Day 12 check-in')
    expect(mail.body).toContain('Dear Sam,')
    expect(mail.body).toContain('day 12 of 42')
    expect(mail.body).toContain('Did it today? Yes')
    expect(mail.body).toContain('One line: made it round the block')
  })
  it('omits friction when empty, includes it when present', () => {
    expect(dailyBuddyMail('Sam', odyssey(), { ...EMPTY_CHECKIN, oneLine: 'x' }, 1).body).not.toContain('What got in the way:')
    expect(dailyBuddyMail('Sam', odyssey(), { ...EMPTY_CHECKIN, oneLine: 'x', friction: 'tired' }, 1).body).toContain('What got in the way: tired')
  })
})

describe('weeklyBuddyMail', () => {
  it('lists the five answers for the week', () => {
    const draft = { ...EMPTY_REFLECTION, daysDone: 5, fit: 'About right' as const, oneAdjustment: 'walk earlier', temperature: 6 }
    const mail = weeklyBuddyMail('Sam', odyssey(), draft, 2)
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · Week 2 reflection')
    expect(mail.body).toContain('Days done: 5 / 7')
    expect(mail.body).toContain('How it felt: About right')
    expect(mail.body).toContain('One change next week: walk earlier')
    expect(mail.body).toContain('How installed it feels: 6 / 10')
  })
})

describe('kickoffBuddyMail', () => {
  it('shares the charter + the pact, asking them to witness', () => {
    const mail = kickoffBuddyMail('Sam', odyssey())
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · will you witness?')
    expect(mail.body).toContain("The habit I'm installing: Move my body before the day takes me")
    expect(mail.body).toContain('When it runs: 2026-07-06 to 2026-08-16')
    expect(mail.body.toLowerCase()).toContain('witness')
  })
  it('falls back to "a new Odyssey" when a draft has no number', () => {
    const mail = kickoffBuddyMail('Sam', odyssey({ number: null }))
    expect(mail.subject).toContain('a new Odyssey')
  })
})

describe('harvestBuddyMail', () => {
  it('states what installed + the outcome', () => {
    const mail = harvestBuddyMail('Sam', odyssey({ notes: 'feels automatic now', outcome: 'Keep' }))
    expect(mail.subject).toBe('Sol Odyssey · Odyssey 3 · harvested')
    expect(mail.body).toContain('What installed: feels automatic now')
    expect(mail.body).toContain('Where it goes next: Keep')
  })
})

describe('buildMailtoUrl', () => {
  it('targets the address and percent-encodes subject + body (CRLF → %0D%0A)', () => {
    const url = buildMailtoUrl('sam@example.com', { subject: 'A B', body: 'line1\r\nline2' })
    expect(url.startsWith('mailto:sam@example.com?')).toBe(true)
    expect(url).toContain('subject=A%20B')
    expect(url).toContain('body=line1%0D%0Aline2')
  })
})

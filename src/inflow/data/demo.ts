/**
 * Demo data: twenty-six months of a Bucharest coaching practice. The first
 * year is smaller: a corporate contract that ended, a weekly client who
 * finished, evening circles at a room rented by the evening. The second grows:
 * private 1:1
 * clients and a couple, intro sessions that never came back, a Saturday group
 * circle, corporate team coaching and workshops, an EU client paying in euro,
 * platform and course payouts in dollars, retreats in the mountains and on a
 * Greek island, guest lectures and a workbook with tax withheld, reimbursed
 * travel, an award and a barter nobody is sure how to tax, and three payments
 * still outstanding. Seasonal: busy autumn, a quiet August.
 *
 * Dates are generated relative to `today`, so the demo always looks current.
 * Classifications and reserves come from the real engine, not hard-coded
 * figures. Every row carries `demo: true` so "Clear demo data" removes exactly
 * these and nothing you entered.
 */
import type { Category, Client, CostRecord, Currency, IncomeRecord, InflowData, Settings, Source, Venue } from '../domain/types'
import { addDays, addMonths, parseDate, startOfMonth, startOfWeek as startOfWeekOf, toDateString } from '../lib/dates'
import { round2, toRon } from '../lib/money'
import { suggestClassification, suggestedWithholding } from '../tax/classify'
import { suggestReserve } from '../tax/estimate'

/** Demo exchange rates, RON per unit. Fixed so the demo never depends on the network. */
const DEMO_FX: Partial<Record<Currency, number>> = { RON: 1, EUR: 5.09, USD: 4.38, GBP: 5.86 }

const C = (id: string, name: string, kind: Client['kind'], country: Client['country'], contact = '', notes = ''): Client =>
  ({ id: `demo_c_${id}`, name, kind, country, contact, notes, archived: false, demo: true })
const S = (id: string, name: string, type: Source['type'], description: string, taxDefault: Source['taxDefault'] = 'profile'): Source =>
  ({ id: `demo_s_${id}`, name, type, description, active: true, taxDefault, demo: true })
const V = (id: string, name: string, type: Venue['type'], location: string, notes = '', deal: Venue['deal'] = 'none', feePerSession = 0, sharePct = 0, monthlyFee = 0): Venue =>
  ({ id: `demo_v_${id}`, name, type, location, notes, archived: false, deal, feePerSession, sharePct, monthlyFee, demo: true })

export const DEMO_CLIENTS: Client[] = [
  C('ioana', 'Ioana Marinescu', 'individual', 'RO', 'ioana.m@example.com', 'Monthly package, 4 sessions. Career transition.'),
  C('radu', 'Radu Stoica', 'individual', 'RO', '', 'Every other week. Referred by Ioana.'),
  C('andreea', 'Andreea Vlad', 'individual', 'RO', '', 'Started in the summer. Weekly, Thursdays.'),
  C('couple', 'Mihai & Ana Petrescu', 'individual', 'RO', '', 'Couples coaching, every other Monday evening. Finished in the spring.'),
  C('clara', 'Clara Ionescu', 'individual', 'RO', '', 'Six-session packages, paid up front.'),
  C('sophie', 'Sophie Laurent', 'individual', 'EU', 'Lyon', 'Online, in English. Pays in euro.'),
  C('nordwind', 'Nordwind Software SRL', 'business', 'RO', 'people@nordwind.example', 'Team-lead group coaching, monthly invoice.'),
  C('northbridge', 'Northbridge Bank SA', 'business', 'RO', 'L&D team', 'Quarterly leadership workshop for branch managers.'),
  C('carpathia', 'Carpathia Logistics SRL', 'business', 'RO', '', 'Two-day management offsite in Brașov.'),
  C('verdant', 'Verdant Labs GmbH', 'business', 'EU', 'Berlin', 'Leadership circle for six managers, online.'),
  C('coachlane', 'Coachlane Inc.', 'business', 'NON_EU', 'Platform payouts', 'US coaching platform; monthly payout in USD.'),
  C('courseline', 'Courseline Ltd', 'business', 'NON_EU', 'London', 'Online course platform: "Calm Leadership", 8 weeks. Payouts in USD.'),
  C('circle', 'Saturday Circle', 'individual', 'RO', '', 'Open group workshop, 6–10 people paying at the door.'),
  C('evening', 'Thursday evening workshops', 'individual', 'RO', '', 'Open evening workshop at the loft, 220 lei a seat. Turnout varies.'),
  C('retreats', 'Mindful Leaders Retreats SRL', 'business', 'RO', '', 'Agency that books the mountain retreats.'),
  C('aegean', 'Aegean Retreats IKE', 'business', 'EU', 'Thessaloniki', 'Books the island retreat; pays in euro.'),
  C('festival', 'Cluj Wellbeing Festival', 'business', 'RO', '', 'Summer festival, one workshop slot.'),
  C('unibuc', 'University of Bucharest', 'business', 'RO', '', 'Guest lectures, paid as copyright (10% withheld).'),
  C('pagina', 'Editura Pagina Vie', 'business', 'RO', '', 'Publisher of the coaching workbook.'),
  C('ngo', 'Fundația Pași Mici', 'business', 'RO', '', 'Mentoring programme for youth workers, monthly stipend.'),
  C('techweek', 'Bucharest Tech Week', 'business', 'RO', '', 'Conference: keynote and workshop.'),
  C('harbour', 'Harbour & Co Ltd', 'business', 'NON_EU', 'London', 'Online workshops for their UK team.'),
  C('foundation', 'Women in Coaching Foundation', 'business', 'RO', '', 'Annual award.'),
  C('studio9', 'Studio Nouă', 'business', 'RO', '', 'Design studio: rebuilt the website in exchange for coaching.'),
  C('vouchers', 'Gift vouchers', 'individual', 'RO', '', 'Vouchers bought as presents.'),
  C('orion', 'Orion Pharma SRL', 'business', 'RO', 'HR', 'First big contract: monthly team coaching. Ended after ten months.'),
  C('elena', 'Elena Dobre', 'individual', 'RO', '', 'Weekly 1:1 in the first year. Finished her programme.'),
  C('lumiere', 'Evening circles', 'individual', 'RO', '', 'Monthly evening circle at Sala Lumière, 120 lei a seat.'),
  C('shala', 'Sunday workshops', 'individual', 'RO', '', 'Every other month at the yoga shala, 180 lei a seat.'),
  // One-off intro sessions: the long tail every practice has.
  C('intro_bogdan', 'Bogdan Tudor', 'individual', 'RO', '', 'Intro session.'),
  C('intro_irina', 'Irina Popa', 'individual', 'RO', '', 'Intro session; came back once.'),
  C('intro_alex', 'Alex Munteanu', 'individual', 'RO', '', 'Intro session.'),
  C('intro_diana', 'Diana Constantin', 'individual', 'RO', '', 'Intro session.'),
  C('intro_victor', 'Victor Sandu', 'individual', 'RO', '', 'Intro session; Zoom from Iași.'),
  C('intro_mara', 'Mara Georgescu', 'individual', 'RO', '', 'Intro session.'),
]

export const DEMO_SOURCES: Source[] = [
  S('direct', 'Direct clients', 'direct', 'People who found me themselves.'),
  S('referral', 'Referrals', 'referral', 'Clients sent by other clients and colleagues.'),
  S('corporate', 'Corporate contracts', 'direct', 'Team and leadership coaching under contract.'),
  S('retainer', 'Monthly packages', 'recurring', 'Pre-paid monthly packages.'),
  S('platform', 'Coachlane platform', 'platform', 'Sessions booked through the platform.'),
  S('course', 'Online course', 'platform', 'Course sales through Courseline.'),
  S('agency', 'Retreat agencies', 'agency', 'Retreats booked and invoiced through an agency.'),
  S('royalties', 'Workbook royalties', 'royalties', 'Royalties from the published workbook.', 'withheld'),
  S('teaching', 'Teaching & lectures', 'other', 'Guest lectures paid under copyright contracts.', 'withheld'),
  S('events', 'Speaking & events', 'other', 'Conferences, festivals, keynotes.'),
  S('ngo', 'NGO programmes', 'other', 'Stipends from foundations.'),
  S('awards', 'Awards, grants & barter', 'other', 'Prizes, grants and exchanges; tax depends on the terms.', 'review'),
]

export const DEMO_VENUES: Venue[] = [
  V('studio', 'Studio Lumina', 'in_person', 'Floreasca, Bucharest', 'Booked and paid by the hour, whoever comes.', 'fixed', 60),
  V('cowork', 'Coworking Cotroceni', 'in_person', 'Cotroceni, Bucharest', 'Saturday mornings, the big room. They keep 30% of the tickets.', 'share', 0, 0.30),
  V('loft', 'Casa Verde loft', 'in_person', 'Dorobanți, Bucharest', 'Thursday evenings. 400 lei per evening, paid in advance.', 'fixed', 400),
  V('zoom', 'Online — Zoom', 'online', 'zoom.us'),
  V('meet', 'Online — Google Meet', 'online', 'meet.google.com', 'What corporate clients prefer.'),
  V('nordwind', 'Nordwind office', 'client_site', 'Pipera, Bucharest'),
  V('northbridge', 'Northbridge HQ', 'client_site', 'Calea Victoriei, Bucharest'),
  V('carpatica', 'Hotel Carpatica', 'in_person', 'Brașov', 'Booked and paid by the client.'),
  V('cabana', 'Cabana Valea Ursului', 'in_person', 'Piatra Craiului', 'Three-day retreats. The agency pays the cabin.'),
  V('thassos', 'Villa Aegean', 'in_person', 'Thassos, Greece', 'Five-day island retreat. The agency pays the villa.'),
  V('festival', 'Festival grounds', 'in_person', 'Cluj-Napoca'),
  V('aula', 'University lecture hall', 'in_person', 'Regina Elisabeta, Bucharest'),
  V('coachlane', 'Coachlane app', 'online', 'coachlane.example', 'The platform keeps 20% of each session.', 'share', 0, 0.20),
  V('course', 'Courseline classroom', 'online', 'courseline.example', 'The platform keeps 15% of sales.', 'share', 0, 0.15),
  V('stage', 'Tech Week main stage', 'in_person', 'Romexpo, Bucharest'),
  V('lumiere', 'Sala Lumière', 'in_person', 'Universitate, Bucharest', 'Evening room. 350 lei a booking, paid whoever comes.', 'fixed', 350),
  V('shala', 'Yoga Shala Herăstrău', 'in_person', 'Herăstrău, Bucharest', 'Sunday workshops. The shala keeps 40% of the tickets.', 'share', 0, 0.40),
]

/** Small deterministic generator, so the demo is the same every time for the same date. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Draft {
  description: string
  amount: number
  currency: Currency
  date: string
  client: string
  source: string
  venue: string
  category: Category
  recurring?: boolean
  expected?: boolean
  notes?: string
  attendees?: number
  /** A platform payout: the sessions in it are the amount over this. */
  perSessionUsd?: number
  /** Sessions the payment covers (default 1) and hours (default by kind of work). */
  sessions?: number
  hours?: number | null
}

/** Typical hours of one session of each kind of work; null where hours mean nothing. */
const HOURS: Partial<Record<Category, number>> = { coaching_1on1: 1, group_coaching: 2, workshop: 3, retreat: 24, speaking: 1.5 }

export const DEMO_SETTINGS_TAX: Settings['tax'] = {
  id: 'pfa_real',
  vatRegistered: false,
  cassCoveredElsewhere: false,
  casExempt: false,
  casOptIn: false,
  annualExpenses: 18_000,
  annualNorm: 0,
  microRate: null,
  dividendPayout: 1,
  customRate: 0.2,
  expectedAnnualIncome: 0,
  expensesFromCosts: true,
}

/** Busy autumn and spring, a quiet August and holiday season. */
const SEASON = [0.8, 0.95, 1.1, 1.1, 1.05, 0.95, 0.75, 0.45, 1.15, 1.2, 1.15, 0.7]

/** Twenty-six months: a smaller first year, then the year the practice grows into. */
const MONTHS = 26
/** Where the second year starts: every pattern below that says `n` counts from here. */
const Y2 = 12

function drafts(today: string): Draft[] {
  const rand = rng(Number(today.slice(0, 7).replace('-', '')))
  const out: Draft[] = []
  const firstMonth = startOfMonth(addMonths(startOfMonth(today), -(MONTHS - 1)))
  const dayIn = (month: string, day: number) => {
    const d = parseDate(month)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return toDateString(new Date(d.getFullYear(), d.getMonth(), Math.min(day, last)))
  }
  const jitter = (base: number, spread: number) => Math.round((base + (rand() - 0.5) * 2 * spread) / 10) * 10
  const season = (date: string) => SEASON[Number(date.slice(5, 7)) - 1]
  const isAugust = (date: string) => date.slice(5, 7) === '08'
  const weekly = (start: string, weekday: number, every: number, end: string, fn: (d: string, i: number) => void) => {
    let d = addDays(start, ((weekday - parseDate(start).getDay() + 7) % 7))
    for (let i = 0; d <= end && d <= today; i++, d = addDays(d, 7 * every)) fn(d, i)
  }
  const monthAt = (i: number) => addMonths(firstMonth, i)

  for (let m = 0; m < MONTHS; m++) {
    const month = monthAt(m)
    const s = season(month)
    // n: the month within the second year (negative in the first).
    const n = m - Y2
    if (n < 0) {
      // First year: Orion's monthly team coaching for ten months, then it ended.
      if (m < 10) out.push({ sessions: 2, description: 'Team coaching — monthly', amount: 4500, currency: 'RON', date: dayIn(month, 11 + Math.floor(rand() * 4)), client: 'orion', source: 'corporate', venue: 'meet', category: 'group_coaching', recurring: true, attendees: 6 })
      // Coachlane, smaller in the first year.
      out.push({ perSessionUsd: 60, description: 'Platform payout', amount: Math.round(jitter(170 + m * 16, 50) * s), currency: 'USD', date: dayIn(month, 1), client: 'coachlane', source: 'platform', venue: 'coachlane', category: 'coaching_1on1', recurring: true })
      continue
    }
    // Ioana: monthly package from month two, paid at the start of the month; a break in August.
    if (n >= 1 && !isAugust(month)) {
      out.push({ sessions: 4, description: 'Monthly package — 4 sessions', amount: n >= 8 ? 1000 : 900, currency: 'RON', date: dayIn(month, 2 + Math.floor(rand() * 3)), client: 'ioana', source: 'retainer', venue: 'studio', category: 'coaching_1on1', recurring: true, notes: n === 8 ? 'New rate from this month.' : undefined })
    }
    // Nordwind: monthly group coaching invoice, paid around the 10th.
    out.push({ sessions: 2, description: 'Team-lead coaching circle', amount: 5000, currency: 'RON', date: dayIn(month, 9 + Math.floor(rand() * 5)), client: 'nordwind', source: 'corporate', venue: n % 3 === 2 ? 'meet' : 'nordwind', category: 'group_coaching', recurring: true, attendees: 7 })
    // Coachlane: monthly USD payout, rising and seasonal.
    out.push({ perSessionUsd: 60, description: 'Platform payout', amount: Math.round(jitter(380 + n * 22, 90) * s), currency: 'USD', date: dayIn(month, 1), client: 'coachlane', source: 'platform', venue: 'coachlane', category: 'coaching_1on1', recurring: true })
    if (n >= 6) {
      // Verdant: EUR leadership circle.
      out.push({ sessions: 2, hours: 3, description: 'Leadership circle — monthly', amount: 1100, currency: 'EUR', date: dayIn(month, 15), client: 'verdant', source: 'corporate', venue: 'zoom', category: 'group_coaching', recurring: true, attendees: 6 })
    }
    if (n >= 3 && !isAugust(month)) {
      // Saturday Circle: second Saturday of the month.
      const first = parseDate(month)
      const sat = addDays(month, ((6 - first.getDay() + 7) % 7) + 7)
      const people = Math.max(5, Math.round((6 + Math.floor(rand() * 5)) * Math.min(1.1, s)))
      out.push({ description: `Saturday Circle — ${people} participants`, amount: people * (n >= 9 ? 220 : 200), currency: 'RON', date: sat, client: 'circle', source: 'direct', venue: 'cowork', category: 'workshop', attendees: people })
    }
    if (n >= 7) {
      // Course sales: launched in month eight, then a long tail.
      const sales = n === 7 ? 1250 : jitter(Math.max(180, 900 - (n - 7) * 95), 120)
      out.push({ description: n === 7 ? 'Course launch payout — Calm Leadership' : 'Course sales payout', amount: sales, currency: 'USD', date: dayIn(month, 6), client: 'courseline', source: 'course', venue: 'course', category: 'content', recurring: n > 7 })
    }
    if (n % 3 === 1) {
      out.push({ description: 'Workbook royalties — quarter', amount: jitter(650, 150), currency: 'RON', date: dayIn(month, 20), client: 'pagina', source: 'royalties', venue: 'zoom', category: 'content', notes: '10% tax withheld by the publisher.' })
    }
    if (n % 3 === 0 && n > 0) {
      out.push({ hours: 6, description: 'Leadership workshop — branch managers', amount: jitter(6500, 700), currency: 'RON', date: dayIn(month, 24), client: 'northbridge', source: 'corporate', venue: 'northbridge', category: 'workshop', attendees: 14 })
    }
    // An NGO programme that ran four months and ended: a recurring arrangement that stopped.
    if (n >= 5 && n <= 8) {
      out.push({ sessions: 2, description: 'Mentoring stipend — youth workers', amount: 800, currency: 'RON', date: dayIn(month, 28), client: 'ngo', source: 'ngo', venue: 'meet', category: 'group_coaching', recurring: true, attendees: 8 })
    }
  }

  // Thursday evening workshops at the loft: fixed rent, uneven turnout. Some evenings lose money.
  const turnout = [7, 3, 9, 2, 11, 6, 4, 12, 8, 5]
  for (let m = Y2 + 4, k = 0; m < MONTHS; m++) {
    const month = monthAt(m)
    if (isAugust(month)) continue
    const first = parseDate(month)
    const thu = addDays(month, ((4 - first.getDay() + 7) % 7) + 14)
    const people = turnout[k++ % turnout.length]
    out.push({ description: `Evening workshop — ${people} ${people === 1 ? 'seat' : 'seats'}`, amount: people * 150, currency: 'RON', date: thu, client: 'evening', source: 'direct', venue: 'loft', category: 'workshop', attendees: people })
  }

  // Evening circles at Sala Lumière since the first year: 350 lei a booking, 100 a seat.
  // Turnout sits just above the four seats that cover the room — never below, never far above.
  const circle = [5, 4, 6, 4, 5, 4, 5, 6, 4, 5, 4, 5]
  for (let m = 2, k = 0; m < MONTHS; m++) {
    const month = monthAt(m)
    if (isAugust(month) || m === Y2 - 1) continue
    const first = parseDate(month)
    const wed = addDays(month, ((3 - first.getDay() + 7) % 7) + 7)
    const people = circle[k++ % circle.length]
    out.push({ description: `Evening circle — ${people} seats`, amount: people * 100, currency: 'RON', date: wed, client: 'lumiere', source: 'direct', venue: 'lumiere', category: 'group_coaching', attendees: people })
  }

  // Sunday workshops at the yoga shala, every other month in the second year: 40% to the shala.
  const sunday = [10, 8, 12, 9, 11, 10]
  for (let m = Y2 + 1, k = 0; m < MONTHS; m += 2) {
    const month = monthAt(m)
    if (isAugust(month)) continue
    const first = parseDate(month)
    const sun = addDays(month, ((0 - first.getDay() + 7) % 7) + 21)
    const people = sunday[k++ % sunday.length]
    out.push({ description: `Sunday workshop — ${people} seats`, amount: people * 150, currency: 'RON', date: sun, client: 'shala', source: 'direct', venue: 'shala', category: 'workshop', attendees: people })
  }

  const end = today
  // Elena: weekly 1:1 on Wednesdays through the first year, then she finished.
  weekly(monthAt(0), 3, 1, monthAt(Y2 + 1), (d) => {
    if (!isAugust(d)) out.push({ description: 'Coaching session', amount: 250, currency: 'RON', date: d, client: 'elena', source: 'direct', venue: 'studio', category: 'coaching_1on1' })
  })
  // Radu: every other Tuesday, alternating studio and Zoom; skips August.
  weekly(monthAt(Y2), 2, 2, end, (d, i) => {
    if (!isAugust(d)) out.push({ description: 'Coaching session', amount: i > 14 ? 350 : 300, currency: 'RON', date: d, client: 'radu', source: 'referral', venue: i % 2 ? 'zoom' : 'studio', category: 'coaching_1on1' })
  })
  // Mihai & Ana: couples coaching, every other Monday, months 2–9.
  weekly(monthAt(Y2 + 1), 1, 2, monthAt(Y2 + 9), (d) => {
    if (!isAugust(d)) out.push({ description: 'Couples session', amount: 400, currency: 'RON', date: d, client: 'couple', source: 'referral', venue: 'studio', category: 'coaching_1on1', attendees: 2 })
  })
  // Andreea: weekly on Thursdays, the last five months.
  weekly(monthAt(MONTHS - 5), 4, 1, end, (d) => {
    out.push({ description: 'Coaching session', amount: 280, currency: 'RON', date: d, client: 'andreea', source: 'direct', venue: rand() < 0.25 ? 'zoom' : 'studio', category: 'coaching_1on1' })
  })
  // Sophie: every other Friday, in euro, the last seven months.
  weekly(monthAt(MONTHS - 7), 5, 2, end, (d) => {
    if (!isAugust(d)) out.push({ description: 'Online session (EN)', amount: 90, currency: 'EUR', date: d, client: 'sophie', source: 'direct', venue: 'zoom', category: 'coaching_1on1' })
  })

  const ago = (months: number, day: number) => dayIn(addMonths(startOfMonth(today), -months), day)
  // Intro sessions, scattered across the year.
  const intros: [string, number, number, string][] = [
    ['bogdan', 12, 7, 'studio'], ['irina', 10, 16, 'studio'], ['irina', 9, 3, 'studio'], ['alex', 8, 21, 'zoom'],
    ['diana', 5, 11, 'studio'], ['victor', 3, 26, 'zoom'], ['mara', 1, 14, 'studio'],
  ]
  for (const [who, back, day, venue] of intros) {
    out.push({ description: 'Intro session', amount: 150, currency: 'RON', date: ago(back, day), client: `intro_${who}`, source: who === 'victor' ? 'referral' : 'direct', venue, category: 'coaching_1on1' })
  }

  out.push(
    { sessions: 6, description: 'Six-session package', amount: 1350, currency: 'RON', date: ago(11, 8), client: 'clara', source: 'direct', venue: 'studio', category: 'coaching_1on1' },
    { sessions: 6, description: 'Six-session package — renewal', amount: 1500, currency: 'RON', date: ago(5, 19), client: 'clara', source: 'direct', venue: 'zoom', category: 'coaching_1on1' },
    { description: 'Spring retreat — facilitation, 3 days', amount: 1500, currency: 'EUR', date: ago(7, 22), client: 'retreats', source: 'agency', venue: 'cabana', category: 'retreat', attendees: 10 },
    { description: 'Autumn retreat — facilitation, 3 days', amount: 7000, currency: 'RON', date: ago(1, 6), client: 'retreats', source: 'agency', venue: 'cabana', category: 'retreat', notes: 'Twelve participants; agency invoice.', attendees: 12 },
    { hours: 35, description: 'Island retreat — 5 days, Thassos', amount: 2400, currency: 'EUR', date: ago(4, 29), client: 'aegean', source: 'agency', venue: 'thassos', category: 'retreat', notes: 'Fourteen participants.', attendees: 14 },
    { description: 'Flights and transfers reimbursed', amount: 280, currency: 'EUR', date: ago(4, 29), client: 'aegean', source: 'agency', venue: 'thassos', category: 'reimbursement', notes: 'At cost, receipts attached to the invoice.' },
    { hours: 14, description: 'Management offsite — 2 days', amount: 8500, currency: 'RON', date: ago(6, 17), client: 'carpathia', source: 'corporate', venue: 'carpatica', category: 'workshop', attendees: 18 },
    { description: 'Festival workshop: "Rest is a skill"', amount: 1000, currency: 'RON', date: ago(4, 9), client: 'festival', source: 'events', venue: 'festival', category: 'speaking', attendees: 35 },
    { description: 'Guest lecture — coaching psychology', amount: 300, currency: 'RON', date: ago(10, 13), client: 'unibuc', source: 'teaching', venue: 'aula', category: 'speaking' },
    { description: 'Guest lecture — coaching psychology', amount: 300, currency: 'RON', date: ago(2, 12), client: 'unibuc', source: 'teaching', venue: 'aula', category: 'speaking' },
    { description: 'Keynote: "Leading without burning out"', amount: 3000, currency: 'RON', date: ago(2, 18), client: 'techweek', source: 'events', venue: 'stage', category: 'speaking' },
    { description: 'Travel costs reimbursed', amount: 640, currency: 'RON', date: ago(2, 18), client: 'techweek', source: 'events', venue: 'stage', category: 'reimbursement', notes: 'Train and hotel, at cost.' },
    { description: 'Online workshop — feedback culture', amount: 700, currency: 'GBP', date: ago(3, 12), client: 'harbour', source: 'referral', venue: 'zoom', category: 'workshop', attendees: 9 },
    { description: 'Coach of the Year award', amount: 2000, currency: 'RON', date: ago(9, 9), client: 'foundation', source: 'awards', venue: 'stage', category: 'other', notes: 'Prize money. Ask the accountant whether it counts as professional income.' },
    { description: 'New website, in exchange for 6 sessions', amount: 1500, currency: 'RON', date: ago(6, 9), client: 'studio9', source: 'awards', venue: 'studio', category: 'other', notes: 'Barter at market value. Is it income? Check.' },
    { description: 'Gift vouchers — Christmas', amount: 2100, currency: 'RON', date: `${Number(today.slice(0, 4)) - 1}-12-15`, client: 'vouchers', source: 'direct', venue: 'studio', category: 'coaching_1on1', notes: 'Three vouchers of three sessions each.' },
    // This week, so the dashboard's week is never empty on a Monday-to-Wednesday visit.
    { description: 'Single session', amount: 280, currency: 'RON', date: today, client: 'intro_mara', source: 'direct', venue: 'studio', category: 'coaching_1on1', notes: 'Came back after the intro.' },
    { description: 'Strategy session (EN)', amount: 120, currency: 'EUR', date: startOfWeekOf(today), client: 'sophie', source: 'direct', venue: 'zoom', category: 'coaching_1on1' },
    // The first year's one-offs.
    { description: 'Summer retreat — facilitation, 3 days', amount: 6000, currency: 'RON', date: ago(16, 18), client: 'retreats', source: 'agency', venue: 'cabana', category: 'retreat', attendees: 9 },
    { description: 'Guest lecture — coaching psychology', amount: 270, currency: 'RON', date: ago(22, 14), client: 'unibuc', source: 'teaching', venue: 'aula', category: 'speaking' },
    { description: 'Gift vouchers — Christmas', amount: 1300, currency: 'RON', date: `${Number(today.slice(0, 4)) - 2}-12-15`, client: 'vouchers', source: 'direct', venue: 'studio', category: 'coaching_1on1', notes: 'Two vouchers of three sessions each.' },
    // Outstanding: two overdue, two coming.
    { sessions: 3, description: 'Six-session package — second half', amount: 750, currency: 'RON', date: addDays(today, -24), client: 'clara', source: 'direct', venue: 'zoom', category: 'coaching_1on1', expected: true, notes: 'Agreed to pay in two parts.' },
    { description: 'Follow-up workshop — invoice sent', amount: 700, currency: 'GBP', date: addDays(today, -6), client: 'harbour', source: 'referral', venue: 'zoom', category: 'workshop', expected: true },
    { description: 'Team-lead coaching circle — next invoice', amount: 5000, currency: 'RON', date: addDays(today, 9), client: 'nordwind', source: 'corporate', venue: 'nordwind', category: 'group_coaching', recurring: true, expected: true },
    { description: 'Leadership workshop — Q1 booking', amount: 7000, currency: 'RON', date: addDays(today, 40), client: 'northbridge', source: 'corporate', venue: 'northbridge', category: 'workshop', expected: true },
  )

  return out.filter((x) => (x.expected || x.date <= today) && x.date >= firstMonth)
}

export function buildDemo(today: string, tax: Settings['tax'] = DEMO_SETTINGS_TAX): InflowData {
  const byId = <T extends { id: string }>(list: T[], key: string, prefix: string) => list.find((x) => x.id === `${prefix}${key}`) ?? null
  const list = drafts(today).sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
  const records: IncomeRecord[] = []
  list.forEach((dr, i) => {
    const client = byId(DEMO_CLIENTS, dr.client, 'demo_c_')
    const source = byId(DEMO_SOURCES, dr.source, 'demo_s_')
    const fxRate = DEMO_FX[dr.currency] ?? 1
    const amountRon = toRon(dr.amount, fxRate)
    const cls = suggestClassification({ category: dr.category, client, source }, tax)
    const taxWithheld = cls.taxHandling === 'withheld' ? suggestedWithholding(amountRon) : 0
    const base = {
      amountRon, date: dr.date, taxability: cls.taxability, taxHandling: cls.taxHandling, taxWithheld,
      status: dr.expected ? 'expected' as const : 'received' as const,
    }
    const reserve = suggestReserve(base, records, tax, dr.date)
    const recent = dr.date > addDays(today, -10)
    records.push({
      id: `demo_r_${String(i).padStart(3, '0')}`,
      description: dr.description,
      amount: dr.amount,
      currency: dr.currency,
      fxRate,
      amountRon,
      date: dr.date,
      status: base.status,
      clientId: client?.id ?? null,
      sourceId: source?.id ?? null,
      venueId: `demo_v_${dr.venue}`,
      category: dr.category,
      recurring: !!dr.recurring,
      attendees: dr.attendees ?? (dr.category === 'coaching_1on1' && dr.client !== 'coachlane' && dr.client !== 'ioana' ? 1 : null),
      sessions: dr.sessions ?? (dr.perSessionUsd ? Math.max(1, Math.round(dr.amount / dr.perSessionUsd)) : 1),
      hours: dr.hours !== undefined ? dr.hours
        : HOURS[dr.category] !== undefined ? HOURS[dr.category]! * (dr.sessions ?? (dr.perSessionUsd ? Math.max(1, Math.round(dr.amount / dr.perSessionUsd)) : 1)) : null,
      notes: dr.notes ?? '',
      taxability: cls.taxability,
      taxHandling: cls.taxHandling,
      vat: cls.vat,
      // The most recent few are left as suggestions, the way a real week looks.
      classification: recent || cls.taxability === 'review' ? 'suggested' : 'confirmed',
      taxReserve: cls.taxability === 'taxable' && !dr.expected ? round2(reserve.amount) : null,
      reserveSource: cls.taxability === 'taxable' && !dr.expected ? 'suggested' : null,
      taxWithheld,
      taxRules: reserve.rulesId,
      demo: true,
    })
  })
  return {
    records,
    costs: demoCosts(today, records),
    clients: DEMO_CLIENTS.map((c) => ({ ...c })),
    sources: DEMO_SOURCES.map((s) => ({ ...s })),
    venues: DEMO_VENUES.map((v) => ({ ...v })),
  }
}

/** Cash on hand when the demo starts, so the cash-flow statement has a real starting point. */
export function demoOpening(today: string): { openingCash: number; openingCashDate: string } {
  return { openingCash: 14_000, openingCashDate: startOfMonth(addMonths(startOfMonth(today), -(MONTHS - 1))) }
}

interface CostDraft {
  description: string
  amount: number
  currency?: Currency
  date: string
  group: CostRecord['group']
  category: CostRecord['category']
  venue?: string
  client?: string
  activity?: Category
  recurring?: boolean
  due?: boolean
  notes?: string
}

/**
 * The practice's outgoings, built around its income: the studio is hired by
 * the session, the coworking room by the Saturday, a co-facilitator works the
 * retreats and the bank workshops. Overheads run monthly; a laptop is bought
 * and depreciated; last year's tax is paid on 25 May; the owner draws a salary.
 */
function demoCosts(today: string, records: IncomeRecord[]): CostRecord[] {
  const rand = rng(Number(today.slice(0, 7).replace('-', '')) + 7)
  const first = startOfMonth(addMonths(startOfMonth(today), -(MONTHS - 1)))
  const out: CostDraft[] = []
  const at = (month: string, day: number) => {
    const d = parseDate(month)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return toDateString(new Date(d.getFullYear(), d.getMonth(), Math.min(day, last)))
  }
  const received = records.filter((r) => r.status === 'received')
  for (let m = 0; m < MONTHS; m++) {
    const month = addMonths(first, m)
    const n = m - Y2
    const inMonth = received.filter((r) => r.date.slice(0, 7) === month.slice(0, 7))
    const studio = inMonth.filter((r) => r.venueId === 'demo_v_studio' && r.category === 'coaching_1on1').length
    if (studio) out.push({ description: `Studio Lumina — ${studio} hours`, amount: studio * 60, date: at(month, 28), group: 'direct', category: 'venue_hire', venue: 'studio', activity: 'coaching_1on1' })
    for (const r of inMonth.filter((x) => x.venueId === 'demo_v_cowork')) {
      out.push({ description: 'Coworking Cotroceni — 30% of tickets', amount: Math.round(r.amountRon * 0.3), date: r.date, group: 'direct', category: 'venue_hire', venue: 'cowork', activity: 'workshop', client: 'circle' })
    }
    for (const r of inMonth.filter((x) => x.venueId === 'demo_v_loft')) {
      out.push({ description: 'Casa Verde loft — evening booking', amount: 400, date: r.date, group: 'direct', category: 'venue_hire', venue: 'loft', activity: 'workshop', client: 'evening' })
      out.push({ description: 'Tea and printed materials', amount: 60, date: r.date, group: 'direct', category: 'materials', venue: 'loft', activity: 'workshop', client: 'evening' })
      out.push({ description: 'Coffee, snacks and printed worksheets', amount: Math.round(140 + rand() * 80), date: r.date, group: 'direct', category: 'materials', venue: 'cowork', activity: 'workshop', client: 'circle' })
    }
    for (const r of inMonth.filter((x) => x.clientId === 'demo_c_coachlane')) {
      out.push({ description: 'Coachlane commission (20%)', amount: Math.round(r.amountRon * 0.2), date: r.date, group: 'direct', category: 'platform_fees', venue: 'coachlane', activity: 'coaching_1on1', client: 'coachlane', recurring: true })
    }
    for (const r of inMonth.filter((x) => x.clientId === 'demo_c_courseline')) {
      out.push({ description: 'Courseline platform fee (15%)', amount: Math.round(r.amountRon * 0.15), date: r.date, group: 'direct', category: 'platform_fees', venue: 'course', activity: 'content', client: 'courseline' })
    }
    for (const r of inMonth.filter((x) => x.venueId === 'demo_v_lumiere')) {
      out.push({ description: 'Sala Lumière — evening booking', amount: 350, date: r.date, group: 'direct', category: 'venue_hire', venue: 'lumiere', activity: 'group_coaching', client: 'lumiere' })
    }
    for (const r of inMonth.filter((x) => x.venueId === 'demo_v_shala')) {
      out.push({ description: 'Yoga Shala — 40% of tickets', amount: Math.round(r.amountRon * 0.4), date: r.date, group: 'direct', category: 'venue_hire', venue: 'shala', activity: 'workshop', client: 'shala' })
      out.push({ description: 'Mats, tea and handouts', amount: 90, date: r.date, group: 'direct', category: 'materials', venue: 'shala', activity: 'workshop', client: 'shala' })
    }
    for (const r of inMonth.filter((x) => x.clientId === 'demo_c_northbridge')) {
      out.push({ description: 'Co-trainer — branch managers workshop', amount: 1200, date: r.date, group: 'direct', category: 'facilitator', venue: 'northbridge', activity: 'workshop', client: 'northbridge' })
    }
    out.push(
      { description: 'Zoom Pro', amount: 75, date: at(month, 5), group: 'operating', category: 'software', recurring: true },
      n >= 0
        ? { description: 'Coworking desk — monthly membership', amount: 850, date: at(month, 2), group: 'operating', category: 'rent', recurring: true }
        : { description: 'Home office share of rent', amount: 400, date: at(month, 2), group: 'operating', category: 'rent', recurring: true },
      { description: 'Utilities share', amount: Math.round(140 + rand() * 60), date: at(month, 15), group: 'operating', category: 'utilities', recurring: true },
      { description: 'Website, domain and booking tool', amount: m % 2 ? 45 : 120, date: at(month, 5), group: 'operating', category: 'software', recurring: true },
      { description: 'Accountant — monthly fee', amount: 300, date: at(month, 20), group: 'operating', category: 'accounting', recurring: true },
      { description: 'Phone and internet', amount: 115, date: at(month, 18), group: 'operating', category: 'phone_internet', recurring: true },
      { description: 'Bank account and card fees', amount: 22, date: at(month, 1), group: 'operating', category: 'bank_fees', recurring: true },
      { description: 'Owner drawing', amount: n < 0 ? 3_000 : n < 4 ? 6_000 : 12_000, date: at(month, 27), group: 'financing', category: 'owner_drawings', recurring: true },
    )
    out.push({ description: 'Supervision session', amount: 300, date: at(month, 12), group: 'operating', category: 'training', recurring: true })
    if (m >= 2) out.push({ description: 'Laptop — monthly depreciation (36 months)', amount: 217, date: at(month, 28), group: 'depreciation', category: 'depreciation', recurring: true })
    const ads = month.slice(5, 7) === '08' ? 0 : n === 7 ? 1_400 : Math.round(((n < 0 ? 120 : 250) + rand() * 300) / 10) * 10
    if (ads) out.push({ description: n === 7 ? 'Course launch ads' : 'Social media ads', amount: ads, date: at(month, 8), group: 'operating', category: 'marketing' })
  }
  const ago = (months: number, day: number) => at(addMonths(startOfMonth(today), -months), day)
  out.push(
    { description: 'Professional liability insurance — year', amount: 720, date: at(addMonths(first, 1), 10), group: 'operating', category: 'insurance' },
    { description: 'Laptop', amount: 7_800, date: at(addMonths(first, 2), 4), group: 'investment', category: 'equipment', notes: 'Depreciated over 36 months.' },
    { description: 'Coaching credential renewal', amount: 1_250, date: at(addMonths(first, 4), 15), group: 'operating', category: 'training' },
    { description: 'Team coaching certification — module 1', amount: 2_900, date: at(addMonths(first, 6), 10), group: 'operating', category: 'training' },
    { description: 'Team coaching certification — module 2', amount: 3_200, date: at(addMonths(first, Y2 + 9), 10), group: 'operating', category: 'training' },
    { description: 'Brand photos and new website design', amount: 2_400, date: at(addMonths(first, Y2 + 5), 18), group: 'operating', category: 'marketing' },
    { description: 'Co-facilitator — spring retreat', amount: 1_500, date: ago(7, 22), group: 'direct', category: 'facilitator', venue: 'cabana', activity: 'retreat', client: 'retreats' },
    { description: 'Retreat materials and journals', amount: 640, date: ago(7, 19), group: 'direct', category: 'materials', venue: 'cabana', activity: 'retreat', client: 'retreats' },
    { description: 'Co-facilitator — island retreat', amount: 400, currency: 'EUR', date: ago(4, 29), group: 'direct', category: 'facilitator', venue: 'thassos', activity: 'retreat', client: 'aegean' },
    { description: 'Flights and transfers, Thassos', amount: 280, currency: 'EUR', date: ago(4, 20), group: 'direct', category: 'travel', venue: 'thassos', activity: 'retreat', client: 'aegean', notes: 'Reimbursed by the agency.' },
    { description: 'Management offsite — train and hotel', amount: 1_100, date: ago(6, 15), group: 'direct', category: 'travel', venue: 'carpatica', activity: 'workshop', client: 'carpathia' },
    { description: 'Train to Cluj and one night', amount: 380, date: ago(4, 8), group: 'direct', category: 'travel', venue: 'festival', activity: 'speaking', client: 'festival' },
    { description: 'Co-facilitator — autumn retreat', amount: 1_800, date: ago(1, 6), group: 'direct', category: 'facilitator', venue: 'cabana', activity: 'retreat', client: 'retreats' },
    { description: 'Retreat materials and journals', amount: 720, date: ago(1, 3), group: 'direct', category: 'materials', venue: 'cabana', activity: 'retreat', client: 'retreats' },
    { description: 'Co-facilitator — summer retreat', amount: 1_300, date: ago(16, 18), group: 'direct', category: 'facilitator', venue: 'cabana', activity: 'retreat', client: 'retreats' },
    { description: 'Course platform — video editing', amount: 1_600, date: at(addMonths(first, Y2 + 6), 22), group: 'direct', category: 'platform_fees', venue: 'course', activity: 'content', client: 'courseline' },
    // Next month's accountant and the bank workshop's co-trainer, not yet paid.
    { description: 'Accountant — monthly fee', amount: 300, date: addDays(today, 25), group: 'operating', category: 'accounting', recurring: true, due: true },
    { description: 'Co-trainer — Q1 branch managers workshop', amount: 1_200, date: addDays(today, 40), group: 'direct', category: 'facilitator', venue: 'northbridge', activity: 'workshop', client: 'northbridge', due: true },
  )
  // The Declarația unică for the year before, paid on 25 May — this year and last.
  for (const [year, cas, income] of [[Number(today.slice(0, 4)), 4_860 + 2_430, 1_480], [Number(today.slice(0, 4)) - 1, 2_430 + 2_430, 620]] as const) {
    const may = `${year}-05-25`
    if (may < first || may > today) continue
    out.push(
      { description: `CAS and CASS for ${year - 1}`, amount: cas, date: may, group: 'tax', category: 'contributions' },
      { description: `Income tax for ${year - 1}`, amount: income, date: may, group: 'tax', category: 'income_tax' },
    )
  }
  return out
    .filter((c) => c.date >= first && (c.due || c.date <= today))
    .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
    .map((c, i): CostRecord => {
      const currency = c.currency ?? 'RON'
      const fxRate = DEMO_FX[currency] ?? 1
      return {
        id: `demo_k_${String(i).padStart(3, '0')}`,
        description: c.description,
        amount: c.amount,
        currency,
        fxRate,
        amountRon: toRon(c.amount, fxRate),
        date: c.date,
        status: c.due ? 'due' : 'paid',
        group: c.group,
        category: c.category,
        venueId: c.venue ? `demo_v_${c.venue}` : null,
        clientId: c.client ? `demo_c_${c.client}` : null,
        activity: c.activity ?? null,
        recurring: !!c.recurring,
        deductible: c.group !== 'investment' && c.group !== 'financing' && c.group !== 'tax',
        notes: c.notes ?? '',
        demo: true,
      }
    })
}

/** Everything the user entered themselves: the data with every demo row removed. */
export function withoutDemo(data: InflowData): InflowData {
  // A user's record can point at a demo client; keep that client so the record keeps its name.
  const costs = data.costs ?? []
  const usedIds = new Set([
    ...data.records.filter((r) => !r.demo).flatMap((r) => [r.clientId, r.sourceId, r.venueId]),
    ...costs.filter((c) => !c.demo).flatMap((c) => [c.clientId, c.venueId]),
  ])
  const keep = <T extends { id: string; demo?: boolean }>(list: T[]) => list.filter((x) => !x.demo || usedIds.has(x.id))
  return {
    records: data.records.filter((r) => !r.demo),
    costs: costs.filter((c) => !c.demo),
    clients: keep(data.clients),
    sources: keep(data.sources),
    venues: keep(data.venues),
  }
}

export function hasDemo(data: InflowData): boolean {
  return data.records.some((r) => r.demo) || (data.costs ?? []).some((c) => c.demo) || data.clients.some((c) => c.demo)
}

/**
 * Demo data: fourteen months of a Bucharest coaching practice — private 1:1
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
import type { Category, Client, Currency, IncomeRecord, InflowData, Settings, Source, Venue } from '../domain/types'
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
const V = (id: string, name: string, type: Venue['type'], location: string, notes = ''): Venue =>
  ({ id: `demo_v_${id}`, name, type, location, notes, archived: false, demo: true })

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
  V('studio', 'Studio Lumina', 'in_person', 'Floreasca, Bucharest', 'Rented by the hour.'),
  V('zoom', 'Online — Zoom', 'online', 'zoom.us'),
  V('meet', 'Online — Google Meet', 'online', 'meet.google.com', 'What corporate clients prefer.'),
  V('nordwind', 'Nordwind office', 'client_site', 'Pipera, Bucharest'),
  V('northbridge', 'Northbridge HQ', 'client_site', 'Calea Victoriei, Bucharest'),
  V('cowork', 'Coworking Cotroceni', 'in_person', 'Cotroceni, Bucharest', 'Saturday mornings, the big room.'),
  V('carpatica', 'Hotel Carpatica', 'in_person', 'Brașov', 'Conference room and garden.'),
  V('cabana', 'Cabana Valea Ursului', 'in_person', 'Piatra Craiului', 'Three-day retreats.'),
  V('thassos', 'Villa Aegean', 'in_person', 'Thassos, Greece', 'Five-day island retreat.'),
  V('festival', 'Festival grounds', 'in_person', 'Cluj-Napoca'),
  V('aula', 'University lecture hall', 'in_person', 'Regina Elisabeta, Bucharest'),
  V('coachlane', 'Coachlane app', 'online', 'coachlane.example'),
  V('course', 'Courseline classroom', 'online', 'courseline.example'),
  V('stage', 'Tech Week main stage', 'in_person', 'Romexpo, Bucharest'),
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
}

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
}

/** Busy autumn and spring, a quiet August and holiday season. */
const SEASON = [0.8, 0.95, 1.1, 1.1, 1.05, 0.95, 0.75, 0.45, 1.15, 1.2, 1.15, 0.7]

const MONTHS = 14

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
    // Ioana: monthly package from month two, paid at the start of the month; a break in August.
    if (m >= 1 && !isAugust(month)) {
      out.push({ description: 'Monthly package — 4 sessions', amount: m >= 8 ? 1400 : 1300, currency: 'RON', date: dayIn(month, 2 + Math.floor(rand() * 3)), client: 'ioana', source: 'retainer', venue: 'studio', category: 'coaching_1on1', recurring: true, notes: m === 8 ? 'New rate from this month.' : undefined })
    }
    // Nordwind: monthly group coaching invoice, paid around the 10th.
    out.push({ description: 'Team-lead coaching circle', amount: 6500, currency: 'RON', date: dayIn(month, 9 + Math.floor(rand() * 5)), client: 'nordwind', source: 'corporate', venue: m % 3 === 2 ? 'meet' : 'nordwind', category: 'group_coaching', recurring: true })
    // Coachlane: monthly USD payout, rising and seasonal.
    out.push({ description: 'Platform payout', amount: Math.round(jitter(380 + m * 22, 90) * s), currency: 'USD', date: dayIn(month, 1), client: 'coachlane', source: 'platform', venue: 'coachlane', category: 'coaching_1on1', recurring: true })
    if (m >= 6) {
      // Verdant: EUR leadership circle.
      out.push({ description: 'Leadership circle — monthly', amount: 1800, currency: 'EUR', date: dayIn(month, 15), client: 'verdant', source: 'corporate', venue: 'zoom', category: 'group_coaching', recurring: true })
    }
    if (m >= 3 && !isAugust(month)) {
      // Saturday Circle: second Saturday of the month.
      const first = parseDate(month)
      const sat = addDays(month, ((6 - first.getDay() + 7) % 7) + 7)
      const people = Math.max(5, Math.round((6 + Math.floor(rand() * 5)) * Math.min(1.1, s)))
      out.push({ description: `Saturday Circle — ${people} participants`, amount: people * (m >= 9 ? 280 : 250), currency: 'RON', date: sat, client: 'circle', source: 'direct', venue: 'cowork', category: 'workshop' })
    }
    if (m >= 7) {
      // Course sales: launched in month eight, then a long tail.
      const sales = m === 7 ? 1250 : jitter(Math.max(180, 900 - (m - 7) * 95), 120)
      out.push({ description: m === 7 ? 'Course launch payout — Calm Leadership' : 'Course sales payout', amount: sales, currency: 'USD', date: dayIn(month, 6), client: 'courseline', source: 'course', venue: 'course', category: 'content', recurring: m > 7 })
    }
    if (m % 3 === 1) {
      out.push({ description: 'Workbook royalties — quarter', amount: jitter(1150, 250), currency: 'RON', date: dayIn(month, 20), client: 'pagina', source: 'royalties', venue: 'zoom', category: 'content', notes: '10% tax withheld by the publisher.' })
    }
    if (m % 3 === 0 && m > 0) {
      out.push({ description: 'Leadership workshop — branch managers', amount: jitter(9800, 1200), currency: 'RON', date: dayIn(month, 24), client: 'northbridge', source: 'corporate', venue: 'northbridge', category: 'workshop' })
    }
    if (m >= 4 && m <= 7) {
      out.push({ description: 'Mentoring stipend — youth workers', amount: 1000, currency: 'RON', date: dayIn(month, 28), client: 'ngo', source: 'ngo', venue: 'meet', category: 'group_coaching', recurring: true })
    }
  }

  const end = today
  // Radu: every other Tuesday, alternating studio and Zoom; skips August.
  weekly(monthAt(0), 2, 2, end, (d, i) => {
    if (!isAugust(d)) out.push({ description: 'Coaching session', amount: i > 14 ? 450 : 400, currency: 'RON', date: d, client: 'radu', source: 'referral', venue: i % 2 ? 'zoom' : 'studio', category: 'coaching_1on1' })
  })
  // Mihai & Ana: couples coaching, every other Monday, months 2–9.
  weekly(monthAt(1), 1, 2, monthAt(9), (d) => {
    if (!isAugust(d)) out.push({ description: 'Couples session', amount: 550, currency: 'RON', date: d, client: 'couple', source: 'referral', venue: 'studio', category: 'coaching_1on1' })
  })
  // Andreea: weekly on Thursdays, the last five months.
  weekly(monthAt(MONTHS - 5), 4, 1, end, (d) => {
    out.push({ description: 'Coaching session', amount: 350, currency: 'RON', date: d, client: 'andreea', source: 'direct', venue: rand() < 0.25 ? 'zoom' : 'studio', category: 'coaching_1on1' })
  })
  // Sophie: every other Friday, in euro, the last seven months.
  weekly(monthAt(MONTHS - 7), 5, 2, end, (d) => {
    if (!isAugust(d)) out.push({ description: 'Online session (EN)', amount: 120, currency: 'EUR', date: d, client: 'sophie', source: 'direct', venue: 'zoom', category: 'coaching_1on1' })
  })

  const ago = (months: number, day: number) => dayIn(addMonths(startOfMonth(today), -months), day)
  // Intro sessions, scattered across the year.
  const intros: [string, number, number, string][] = [
    ['bogdan', 12, 7, 'studio'], ['irina', 10, 16, 'studio'], ['irina', 9, 3, 'studio'], ['alex', 8, 21, 'zoom'],
    ['diana', 5, 11, 'studio'], ['victor', 3, 26, 'zoom'], ['mara', 1, 14, 'studio'],
  ]
  for (const [who, back, day, venue] of intros) {
    out.push({ description: 'Intro session', amount: 200, currency: 'RON', date: ago(back, day), client: `intro_${who}`, source: who === 'victor' ? 'referral' : 'direct', venue, category: 'coaching_1on1' })
  }

  out.push(
    { description: 'Six-session package', amount: 1800, currency: 'RON', date: ago(11, 8), client: 'clara', source: 'direct', venue: 'studio', category: 'coaching_1on1' },
    { description: 'Six-session package — renewal', amount: 1950, currency: 'RON', date: ago(5, 19), client: 'clara', source: 'direct', venue: 'zoom', category: 'coaching_1on1' },
    { description: 'Spring retreat — facilitation, 3 days', amount: 2400, currency: 'EUR', date: ago(7, 22), client: 'retreats', source: 'agency', venue: 'cabana', category: 'retreat' },
    { description: 'Autumn retreat — facilitation, 3 days', amount: 9800, currency: 'RON', date: ago(1, 6), client: 'retreats', source: 'agency', venue: 'cabana', category: 'retreat', notes: 'Twelve participants; agency invoice.' },
    { description: 'Island retreat — 5 days, Thassos', amount: 3600, currency: 'EUR', date: ago(4, 29), client: 'aegean', source: 'agency', venue: 'thassos', category: 'retreat', notes: 'Fourteen participants.' },
    { description: 'Flights and transfers reimbursed', amount: 280, currency: 'EUR', date: ago(4, 29), client: 'aegean', source: 'agency', venue: 'thassos', category: 'reimbursement', notes: 'At cost, receipts attached to the invoice.' },
    { description: 'Management offsite — 2 days', amount: 7200, currency: 'RON', date: ago(6, 17), client: 'carpathia', source: 'corporate', venue: 'carpatica', category: 'workshop' },
    { description: 'Festival workshop: "Rest is a skill"', amount: 1500, currency: 'RON', date: ago(4, 9), client: 'festival', source: 'events', venue: 'festival', category: 'speaking' },
    { description: 'Guest lecture — coaching psychology', amount: 1200, currency: 'RON', date: ago(10, 13), client: 'unibuc', source: 'teaching', venue: 'aula', category: 'speaking' },
    { description: 'Guest lecture — coaching psychology', amount: 1200, currency: 'RON', date: ago(2, 12), client: 'unibuc', source: 'teaching', venue: 'aula', category: 'speaking' },
    { description: 'Keynote: "Leading without burning out"', amount: 3500, currency: 'RON', date: ago(2, 18), client: 'techweek', source: 'events', venue: 'stage', category: 'speaking' },
    { description: 'Travel costs reimbursed', amount: 640, currency: 'RON', date: ago(2, 18), client: 'techweek', source: 'events', venue: 'stage', category: 'reimbursement', notes: 'Train and hotel, at cost.' },
    { description: 'Online workshop — feedback culture', amount: 950, currency: 'GBP', date: ago(3, 12), client: 'harbour', source: 'referral', venue: 'zoom', category: 'workshop' },
    { description: 'Coach of the Year award', amount: 2000, currency: 'RON', date: ago(9, 9), client: 'foundation', source: 'awards', venue: 'stage', category: 'other', notes: 'Prize money. Ask the accountant whether it counts as professional income.' },
    { description: 'New website, in exchange for 6 sessions', amount: 2400, currency: 'RON', date: ago(6, 3), client: 'studio9', source: 'awards', venue: 'studio', category: 'other', notes: 'Barter at market value. Is it income? Check.' },
    { description: 'Gift vouchers — Christmas', amount: 1500, currency: 'RON', date: `${Number(today.slice(0, 4)) - 1}-12-15`, client: 'vouchers', source: 'direct', venue: 'studio', category: 'coaching_1on1', notes: 'Three vouchers of three sessions each.' },
    // This week, so the dashboard's week is never empty on a Monday-to-Wednesday visit.
    { description: 'Single session', amount: 400, currency: 'RON', date: today, client: 'intro_mara', source: 'direct', venue: 'studio', category: 'coaching_1on1', notes: 'Came back after the intro.' },
    { description: 'Strategy session (EN)', amount: 150, currency: 'EUR', date: startOfWeekOf(today), client: 'sophie', source: 'direct', venue: 'zoom', category: 'coaching_1on1' },
    // Outstanding: one overdue, two coming.
    { description: 'Follow-up workshop — invoice sent', amount: 950, currency: 'GBP', date: addDays(today, -6), client: 'harbour', source: 'referral', venue: 'zoom', category: 'workshop', expected: true },
    { description: 'Team-lead coaching circle — next invoice', amount: 6500, currency: 'RON', date: addDays(today, 9), client: 'nordwind', source: 'corporate', venue: 'nordwind', category: 'group_coaching', recurring: true, expected: true },
    { description: 'Leadership workshop — Q1 booking', amount: 10500, currency: 'RON', date: addDays(today, 40), client: 'northbridge', source: 'corporate', venue: 'northbridge', category: 'workshop', expected: true },
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
    clients: DEMO_CLIENTS.map((c) => ({ ...c })),
    sources: DEMO_SOURCES.map((s) => ({ ...s })),
    venues: DEMO_VENUES.map((v) => ({ ...v })),
  }
}

/** Everything the user entered themselves: the data with every demo row removed. */
export function withoutDemo(data: InflowData): InflowData {
  // A user's record can point at a demo client; keep that client so the record keeps its name.
  const usedIds = new Set(data.records.filter((r) => !r.demo).flatMap((r) => [r.clientId, r.sourceId, r.venueId]))
  const keep = <T extends { id: string; demo?: boolean }>(list: T[]) => list.filter((x) => !x.demo || usedIds.has(x.id))
  return {
    records: data.records.filter((r) => !r.demo),
    clients: keep(data.clients),
    sources: keep(data.sources),
    venues: keep(data.venues),
  }
}

export function hasDemo(data: InflowData): boolean {
  return data.records.some((r) => r.demo) || data.clients.some((c) => c.demo)
}

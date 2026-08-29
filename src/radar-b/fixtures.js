// Demo-mode data: a plausible Bucharest week, shaped exactly as the /recommend in
// Bucharest skill writes it. Deliberately includes the hard cases, because demo
// mode is also where the dedupe/merge logic gets exercised by hand:
//
//   • the same exhibition arriving from three sources with different detail levels
//   • a Facebook-origin event with a poster and no ticket link
//   • a four-month exhibition (a long run, not a day)
//   • a multi-day festival
//   • an event with only a title, a venue and a rough date (confidence: uncertain)
//   • an event already sitting in Wanderlist
//   • a stale row nobody has re-checked in weeks

import { normalizeEvent } from './model.js'
import { endOfWeek, startOfDay } from './dates.js'

/** Dates are generated relative to "today" so the demo is never out of date. */
function day(offset, time) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return time ? `${iso}T${time}:00+03:00` : iso
}

/** A day offset that lands within the current calendar week no matter which day
 *  the suite runs on — `day(3)` used to run off the end of "week" on a Thu/Fri/Sat,
 *  since the "week" lens ends at Sunday (see dates.js's endOfWeek) rather than
 *  rolling seven days out. */
function dayThisWeek(preferredOffset, time) {
  const now = new Date()
  const daysLeftInWeek = Math.round((endOfWeek(now) - startOfDay(now)) / 86400000)
  return day(Math.min(preferredOffset, daysLeftInWeek), time)
}

const RAW = [
  {
    id: 'demo-1', key: 'combinatul-fondului-plastic:lumina-difuza',
    name: 'Lumină difuză — expoziție de grup',
    start: day(0), end: day(74), hasTime: false,
    venue: 'Combinatul Fondului Plastic', address: 'Str. Băiculești 29', area: 'bucureștii noi',
    category: 'art',
    summary: 'Șase artiști tineri lucrează cu lumina ca material, nu ca subiect — instalații care se schimbă cu ora din zi. Spațiul industrial face jumătate din treabă. Merge oricând, dar cel mai bine spre seară.',
    signals: ['recommended', 'free'],
    link: 'https://example.org/cfp/lumina-difuza',
    image: null, organizer: 'Combinatul Fondului Plastic',
    sources: [
      { name: 'Curatorial', url: 'https://curatorial.ro/arta/recomandarile-curatorial/', date: day(-2), kind: 'recommendation' },
      { name: 'B365', url: 'https://b365.ro/bucuresti-de-weekend/', date: day(-3), kind: 'editorial' },
      { name: 'Combinatul Fondului Plastic', url: 'https://example.org/cfp/lumina-difuza', date: day(-1), kind: 'editorial' },
    ],
    confidence: 'confirmed', checked: day(-1),
  },
  {
    id: 'demo-2', key: 'control-club:trio-nocturn',
    name: 'Trio Nocturn — jazz de improvizație',
    start: day(0, '21:00'), hasTime: true,
    venue: 'Control Club', address: 'Str. Constantin Mille 4', area: 'centru',
    category: 'concert',
    summary: 'Set de improvizație liberă, fără repertoriu anunțat. Trioul cântă rar în București și niciodată același lucru de două ori.',
    signals: ['recommended', 'ticketed'], cost: 60,
    link: 'https://example.org/control/trio-nocturn',
    tickets: 'https://iabilet.ro/bilete-trio-nocturn',
    sources: [
      { name: 'Recomandata', url: 'https://recomandata9.substack.com/p/nr-212', date: day(-2), kind: 'recommendation' },
      { name: 'Facebook', url: 'https://www.facebook.com/events/1234567890/', date: day(-2), kind: 'editorial' },
    ],
    confidence: 'confirmed', checked: day(0),
  },
  {
    id: 'demo-3', key: 'strada-armeneasca:festivalul-strazii',
    name: 'Festivalul Strada Armenească',
    start: day(1), end: day(3), hasTime: false,
    venue: 'Strada Armenească', address: 'Str. Armenească', area: 'armenească',
    category: 'event',
    summary: 'Strada se închide trei zile: concerte pe trotuar, ateliere pentru copii, curțile caselor deschise publicului. Cel mai bun moment e sâmbătă după-amiază.',
    signals: ['free', 'family', 'outdoor'],
    link: 'https://example.org/strada-armeneasca',
    sources: [
      { name: 'B365', url: 'https://b365.ro/bucuresti-de-weekend/', date: day(-3), kind: 'editorial' },
      { name: 'Zile și Nopți', url: 'https://zilesinopti.ro/evenimente-bucuresti-weekend/', date: day(-1), kind: 'editorial' },
    ],
    confidence: 'reported', checked: day(-1),
  },
  {
    id: 'demo-4', key: 'cinema-elvire-popesco:retrospectiva-varda',
    name: 'Retrospectivă Agnès Varda — Cléo de 5 à 7',
    start: dayThisWeek(2, '19:30'), hasTime: true,
    venue: 'Cinema Elvire Popesco', address: 'Bd. Dacia 77', area: 'centru',
    category: 'movie',
    summary: 'Copie restaurată, subtitrare în română. Prima din patru proiecții din retrospectivă.',
    signals: ['ticketed'], cost: 25,
    link: 'https://example.org/elvire-popesco/varda',
    sources: [{ name: 'Institut Français', url: 'https://example.org/if/varda', date: day(-4), kind: 'editorial' }],
    confidence: 'confirmed', checked: day(-4),
  },
  {
    id: 'demo-5', key: null,
    name: 'Lansare de carte la Cărturești Verona',
    start: dayThisWeek(3), hasTime: false,
    venue: 'Cărturești Verona', area: 'centru',
    category: 'culture',
    summary: null,
    signals: [],
    sources: [{ name: 'HotNews', url: 'https://hotnews.ro/weekend-trending', date: day(-3), kind: 'editorial' }],
    confidence: 'uncertain', checked: day(-3),
  },
  {
    id: 'demo-6', key: 'muzeul-national-de-arta:atelier-copii',
    name: 'Atelier de gravură pentru copii',
    start: dayThisWeek(2, '11:00'), hasTime: true,
    venue: 'Muzeul Național de Artă al României', address: 'Calea Victoriei 49-53', area: 'centru',
    category: 'culture',
    summary: 'Două ore, 7–12 ani, materialele incluse. Locurile se ocupă repede — rezervarea se face prin site.',
    signals: ['family', 'ticketed'], cost: 40,
    link: 'https://example.org/mnar/atelier-gravura',
    sources: [{ name: 'Harta Muzeelor', url: 'https://hartamuzeelor.ro/recomandari.html', date: day(-1), kind: 'recommendation' }],
    confidence: 'confirmed', checked: day(-1),
  },
  {
    id: 'demo-7', key: 'platforma-wolff:noapte-electronica',
    name: 'Platforma Wolff — noapte electronică',
    start: day(1, '23:00'), hasTime: true,
    venue: 'Platforma Wolff', address: 'Str. Ion Câmpineanu 11', area: 'centru',
    category: 'event',
    summary: 'Line-up local, fără headliner anunțat. Genul de seară care se decide pe loc.',
    signals: ['ticketed'], cost: 50,
    sources: [{ name: 'Zile și Nopți', url: 'https://zilesinopti.ro/evenimente-bucuresti-weekend/', date: day(-1), kind: 'editorial' }],
    confidence: 'reported', checked: day(-1),
  },
  {
    id: 'demo-8', key: 'gradina-botanica:tur-ghidat',
    name: 'Tur ghidat prin Grădina Botanică',
    start: day(9, '10:00'), hasTime: true,
    venue: 'Grădina Botanică „D. Brandza"', address: 'Șos. Cotroceni 32', area: 'cotroceni',
    category: 'event',
    summary: 'Tur de două ore cu un botanist, concentrat pe serele istorice. Se repetă lunar.',
    signals: ['outdoor', 'family', 'recurring'], cost: 30,
    sources: [{ name: 'Buletin', url: 'https://buletin.de/bucuresti/agenda-urbana-cu-cosmin', date: day(-20), kind: 'editorial' }],
    confidence: 'reported', checked: day(-20),
  },
  {
    id: 'demo-9', key: 'arcub:teatru-documentar',
    name: 'Teatru documentar: mărturii din Ferentari',
    start: day(4, '19:00'), hasTime: true,
    venue: 'ARCUB — Hanul Gabroveni', address: 'Str. Lipscani 84-90', area: 'centru vechi',
    category: 'play',
    summary: 'Spectacol construit din interviuri reale, jucat de o distribuție mixtă de actori și locuitori ai cartierului.',
    signals: ['recommended', 'ticketed'], cost: 45,
    link: 'https://example.org/arcub/ferentari',
    sources: [
      { name: 'Recomandata', url: 'https://recomandata9.substack.com/p/nr-212', date: day(-2), kind: 'recommendation' },
    ],
    confidence: 'confirmed', checked: day(-2),
  },
]

/** A second, deliberately messier copy of demo-1 — the same exhibition as a
 *  different source would have written it. In the app these MERGE into one event
 *  with three sources; that's the single most important thing demo mode shows. */
const DUPLICATE = {
  id: 'demo-1b', key: null,
  name: 'Expoziția „Lumină difuză" la Combinatul Fondului Plastic',
  start: day(0), end: day(74), hasTime: false,
  venue: 'Combinatul Fondului Plastic', area: 'bucureștii noi',
  category: 'art',
  summary: 'Expoziție de grup despre lumină, în halele Combinatului.',
  signals: [],
  sources: [{ name: 'Buletin', url: 'https://buletin.de/bucuresti/agenda-urbana-cu-cosmin', date: day(-3), kind: 'editorial' }],
  confidence: 'reported', checked: day(-3),
}

/** Already in Wanderlist — shows the "In your Wanderlist" state without a token. */
const SAVED = {
  // The id of THE SAME entry in Wanderlist's own demo fixtures — not merely a
  // Notion-SHAPED id. Both sides being separately Notion-shaped is what the first
  // attempt at this did, and it made every demo handoff land on Wanderlist's
  // "couldn't find that item" path; each app's tests passed because each only
  // ever checked its own id. `the demo handoff actually lands` in
  // wanderlist.test.js is the guard. Change this id and change it there too.
  id: 'de3705a1d9e94c0fb1a7c5e2d0846f31',
  name: 'Trio Nocturn',
  start: day(0, '21:00'), hasTime: true,
  venue: 'Control Club, Str. Constantin Mille 4, București',
  category: 'concert',
  summary: 'Jazz de improvizație. Mi-a recomandat-o Radu.',
  signals: ['ticketed'],
  sources: [{ name: 'Wanderlist', url: null, date: day(-2), kind: 'saved' }],
  confidence: 'reported', checked: day(-2),
  origin: 'wanderlist', saved: true,
  // The decisions already made on the Wanderlist side, mirroring that entry so
  // the "În Wanderlist" chips have something true to show in demo mode.
  going: true, plannedDate: day(0), plannedTime: '21:00', dateExpiring: day(0),
}

/** Saved from somewhere OTHER than Radar's own discovery (Marquee, in the real
 *  bug report this fixture stands in for) — no Radar row anywhere matches it.
 *  Proves the pool filter in App.jsx keeps a genuine cross-reference (SAVED
 *  above, which DOES have a matching Radar entry) while dropping an entry
 *  that exists only because it's in Wanderlist. Radar-B's calendar is what
 *  Radar found, not everything Wanderlist happens to hold. */
const MARQUEE_ONLY_SAVED = {
  id: 'marquee-only-saved-fixture',
  name: 'CU DRAG, VAN GOGH / Loving Vincent',
  start: day(1, '20:30'), hasTime: true,
  venue: 'Cinema Muzeul Țăranului',
  category: 'movie',
  summary: 'Kept from Marquee, not found by Radar.',
  signals: ['ticketed'],
  sources: [{ name: 'Wanderlist', url: null, date: day(-1), kind: 'saved' }],
  confidence: 'reported', checked: day(-1),
  origin: 'wanderlist', saved: true,
  going: false, plannedDate: day(1), plannedTime: '20:30', dateExpiring: day(1),
}

export const DEMO_EVENTS = [...RAW, DUPLICATE].map(normalizeEvent)
export const DEMO_SAVED = [SAVED, MARQUEE_ONLY_SAVED].map(normalizeEvent)

export const DEMO_SUGGESTED = {
  refreshedAt: 'demo',
  links: [
    { source: 'Buletin', title: 'Agenda Urbană cu Cosmin', url: 'https://buletin.de/bucuresti/agenda-urbana-cu-cosmin', pending: false },
    { source: 'HotNews', title: 'Weekend trending în București', url: 'https://hotnews.ro/weekend-trending', pending: false },
    { source: 'B365', title: 'București de weekend', url: 'https://b365.ro/bucuresti-de-weekend/', pending: false },
    { source: 'Curatorial', title: 'Recomandările Curatorial', url: 'https://curatorial.ro/arta/recomandarile-curatorial/', pending: false },
    { source: 'Recomandata', title: 'Nr. 212', url: 'https://recomandata9.substack.com/p/nr-212', pending: false },
    { source: 'Harta Muzeelor', title: 'Weekend Sessions', url: 'https://hartamuzeelor.ro/recomandari.html', pending: false },
    { source: 'Zile și Nopți', title: '⏳ nepublicat încă', url: null, pending: true },
  ],
}

export function createFixtureClient() {
  const saved = [...DEMO_SAVED]
  const dismissedDemo = new Set()
  return {
    mode: 'demo',
    radarDatabaseId: null,
    findingsDatabaseId: null,
    async listEvents() { return dismissedDemo.size
      ? DEMO_EVENTS.map((e) => (dismissedDemo.has(e.id) ? { ...e, dismissed: true } : e))
      : DEMO_EVENTS },
    async setDismissed(radarId, dismissed) {
      // Demo mode round-trips the dismissal for the session, so Undo is a real
      // interaction rather than a dead button before a token is configured.
      if (dismissed) dismissedDemo.add(radarId)
      else dismissedDemo.delete(radarId)
      return { id: radarId, dismissed }
    },
    async listSaved() { return saved },
    async getSuggested() { return DEMO_SUGGESTED },
    async saveToWanderlist(draft) {
      // Demo mode still round-trips, so the "saved" state is real for the session.
      const entry = normalizeEvent({
        id: `demo-saved-${saved.length + 1}`,
        name: draft.name, start: draft.plannedDate, hasTime: false,
        venue: draft.place, category: draft.category, summary: draft.description,
        sources: [{ name: 'Wanderlist', date: draft.dateAdded, kind: 'saved' }],
        origin: 'wanderlist', saved: true,
      })
      saved.push(entry)
      return entry
    },
    async probe() { return { ok: true, hasRows: true } },
  }
}

// Sample Bucharest backlog for demo mode — what the app shows before you connect your
// own Notion database, so it feels like a real, lived-in list of things to do. Content
// is representative (venues, a film series, a free exhibition, a couple of ideas), not
// pulled from anyone's private data. Dates are computed RELATIVE to today at seed time,
// so a fresh demo always has something expiring soon, something planned, and something
// already past — rather than decaying into an all-expired list as the calendar moves on.
// (Seeding happens once per browser — see fixtureClient's load() — so an existing demo
// keeps its dates; only new visitors get fresh ones.)
//
// Category/tag values are lowercase, matching how live data always reads back from
// Notion (notion.js normalizes on both read and write) — the demo shows the app's real
// conventions, not a prettier variant of them.
//
// Mirrors the app model in notion.js. `id`s are stable so React keys don't churn.
import { todayKey, keyToDate } from './dates.js'

function daysFromToday(n) {
  const d = keyToDate(todayKey())
  d.setDate(d.getDate() + n)
  return todayKey(d)
}

export function seedEntries() {
  return [
    {
      id: 'seed-1',
      name: 'Anim’est — closing night at Cinema Pro',
      description:
        'The international animation festival wraps with a shorts programme and an awards gala. Tickets go fast for the closing screening — grab one before the run ends.',
      link: 'https://animest.ro',
      category: 'event',
      place: 'Cinema Pro, Str. Ion Ghica 3, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Cinema%20Pro%20Bucuresti',
      tags: ['ticketed', 'film', 'with-friends', 'nightlife'],
      attended: false,
      dateAdded: daysFromToday(-7),
      dateExpiring: daysFromToday(2),
      plannedDate: daysFromToday(3),
      plannedTime: '19:30',
      tickets: [{ url: 'https://animest.ro/ticket.pdf', name: 'closing-night.pdf', fileUploadId: null }],
    },
    {
      id: 'seed-2',
      name: 'Brâncuși retrospective — MNAR',
      description:
        'A rare gathering of Brâncuși works at the National Museum of Art. Timed-entry tickets; the early slots sell out first. Give it a slow morning.',
      link: 'https://www.mnar.arts.ro',
      category: 'art',
      place: 'Muzeul Național de Artă al României, Calea Victoriei 49–53',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Muzeul%20National%20de%20Arta%20Bucuresti',
      tags: ['ticketed', 'culture', 'solo'],
      attended: false,
      dateAdded: daysFromToday(-14),
      dateExpiring: daysFromToday(6),
      plannedDate: daysFromToday(4),
    },
    {
      id: 'seed-3',
      name: 'Open-air jazz at Grădina Uranus',
      description:
        'Free Sunday-evening jazz sessions in the garden through the summer. No booking — just turn up while the light lasts. Bring someone.',
      link: 'https://gradinauranus.ro',
      category: 'event',
      place: 'Grădina Uranus, Str. Uranus 42, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Gradina%20Uranus%20Bucuresti',
      tags: ['free', 'outdoor', 'music', 'with-friends'],
      attended: false,
      dateAdded: daysFromToday(-8),
      dateExpiring: null,
      plannedDate: daysFromToday(11),
    },
    {
      id: 'seed-4',
      name: 'Cărturești Carusel — late-night reading room',
      description:
        'The spiral bookshop keeps a quiet top-floor reading nook open late on weekdays. A good rainy-evening fallback when nothing’s on.',
      link: 'https://carturesti.ro',
      category: 'venue',
      place: 'Cărturești Carusel, Str. Lipscani 55',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Carturesti%20Carusel%20Bucuresti',
      tags: ['free', 'indoor', 'solo', 'reading'],
      attended: false,
      dateAdded: daysFromToday(-20),
      dateExpiring: null,
      plannedDate: null,
    },
    {
      id: 'seed-5',
      name: 'Guided walk — Bucharest’s Art Deco',
      description:
        'A two-hour walking tour of the interwar façades around Magheru. Register in advance; the small-group slots are limited.',
      link: '',
      category: 'culture',
      place: 'Bulevardul Gheorghe Magheru, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Bulevardul%20Magheru%20Bucuresti',
      tags: ['ticketed', 'outdoor', 'walk', 'history'],
      attended: false,
      dateAdded: daysFromToday(-3),
      dateExpiring: daysFromToday(1),
      plannedDate: daysFromToday(5),
    },
    {
      id: 'seed-6',
      name: 'Try the new ramen place in Dorobanți',
      description:
        'Everyone keeps mentioning it. No reservations, so go early or off-peak. Not urgent — just don’t let it slip for another three months.',
      link: '',
      category: 'idea',
      place: 'Dorobanți, București',
      placeUrl: '',
      tags: ['food', 'solo', 'discovery'],
      attended: false,
      dateAdded: daysFromToday(-26),
      dateExpiring: null,
      plannedDate: null,
    },
    {
      id: 'seed-7',
      name: 'Enescu Festival — Beethoven cycle (attended)',
      description:
        'The opening night of the Beethoven symphonic cycle at the Athenaeum. Went with M.; the acoustics under the dome were everything people promise. Keeping it here to remember.',
      link: 'https://festivalenescu.ro',
      category: 'culture',
      place: 'Ateneul Român, Str. Benjamin Franklin 1–3',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Ateneul%20Roman%20Bucuresti',
      tags: ['ticketed', 'music', 'with-friends'],
      attended: true,
      dateAdded: daysFromToday(-49),
      dateExpiring: daysFromToday(-41),
      plannedDate: daysFromToday(-39),
    },
  ]
}

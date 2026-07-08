// Sample Bucharest backlog for demo mode — what the app shows before you connect your
// own Notion database, so it feels like a real, lived-in list of things to do. Content
// is representative (venues, a film series, a free exhibition, a couple of ideas), not
// pulled from anyone's private data. Dates sit around the app's build window so the
// "expiring soon" float and the status segment both have something to show.
//
// Mirrors the app model in notion.js. `id`s are stable so React keys don't churn.
export function seedEntries() {
  return [
    {
      id: 'seed-1',
      name: 'Anim’est — closing night at Cinema Pro',
      description:
        'The international animation festival wraps with a shorts programme and an awards gala. Tickets go fast for the closing screening — grab one before the run ends.',
      link: 'https://animest.ro',
      category: 'Event',
      place: 'Cinema Pro, Str. Ion Ghica 3, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Cinema%20Pro%20Bucuresti',
      tags: ['ticketed', 'film', 'with-friends', 'nightlife'],
      attended: false,
      dateAdded: '2026-07-01',
      dateExpiring: '2026-07-10',
      plannedDate: '2026-07-11',
      tickets: [{ url: 'https://animest.ro/ticket.pdf', name: 'closing-night.pdf', fileUploadId: null }],
    },
    {
      id: 'seed-2',
      name: 'Brâncuși retrospective — MNAR',
      description:
        'A rare gathering of Brâncuși works at the National Museum of Art. Timed-entry tickets; the early slots sell out first. Give it a slow morning.',
      link: 'https://www.mnar.arts.ro',
      category: 'Art',
      place: 'Muzeul Național de Artă al României, Calea Victoriei 49–53',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Muzeul%20National%20de%20Arta%20Bucuresti',
      tags: ['ticketed', 'culture', 'solo'],
      attended: false,
      dateAdded: '2026-06-24',
      dateExpiring: '2026-07-14',
      plannedDate: '2026-07-12',
    },
    {
      id: 'seed-3',
      name: 'Open-air jazz at Grădina Uranus',
      description:
        'Free Sunday-evening jazz sessions in the garden through the summer. No booking — just turn up while the light lasts. Bring someone.',
      link: 'https://gradinauranus.ro',
      category: 'Event',
      place: 'Grădina Uranus, Str. Uranus 42, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Gradina%20Uranus%20Bucuresti',
      tags: ['free', 'outdoor', 'music', 'with-friends'],
      attended: false,
      dateAdded: '2026-06-30',
      dateExpiring: null,
      plannedDate: '2026-07-19',
    },
    {
      id: 'seed-4',
      name: 'Cărturești Carusel — late-night reading room',
      description:
        'The spiral bookshop keeps a quiet top-floor reading nook open late on weekdays. A good rainy-evening fallback when nothing’s on.',
      link: 'https://carturesti.ro',
      category: 'Venue',
      place: 'Cărturești Carusel, Str. Lipscani 55',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Carturesti%20Carusel%20Bucuresti',
      tags: ['free', 'indoor', 'solo', 'reading'],
      attended: false,
      dateAdded: '2026-06-18',
      dateExpiring: null,
      plannedDate: null,
    },
    {
      id: 'seed-5',
      name: 'Guided walk — Bucharest’s Art Deco',
      description:
        'A two-hour walking tour of the interwar façades around Magheru. Register in advance; the small-group slots are limited.',
      link: '',
      category: 'Culture',
      place: 'Bulevardul Gheorghe Magheru, București',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Bulevardul%20Magheru%20Bucuresti',
      tags: ['ticketed', 'outdoor', 'walk', 'history'],
      attended: false,
      dateAdded: '2026-07-05',
      dateExpiring: '2026-07-09',
      plannedDate: '2026-07-13',
    },
    {
      id: 'seed-6',
      name: 'Try the new ramen place in Dorobanți',
      description:
        'Everyone keeps mentioning it. No reservations, so go early or off-peak. Not urgent — just don’t let it slip for another three months.',
      link: '',
      category: 'Idea',
      place: 'Dorobanți, București',
      placeUrl: '',
      tags: ['food', 'solo', 'discovery'],
      attended: false,
      dateAdded: '2026-06-12',
      dateExpiring: null,
      plannedDate: null,
    },
    {
      id: 'seed-7',
      name: 'Enescu Festival — Beethoven cycle (attended)',
      description:
        'The opening night of the Beethoven symphonic cycle at the Athenaeum. Went with M.; the acoustics under the dome were everything people promise. Keeping it here to remember.',
      link: 'https://festivalenescu.ro',
      category: 'Culture',
      place: 'Ateneul Român, Str. Benjamin Franklin 1–3',
      placeUrl: 'https://www.google.com/maps/search/?api=1&query=Ateneul%20Roman%20Bucuresti',
      tags: ['ticketed', 'music', 'with-friends'],
      attended: true,
      dateAdded: '2026-05-20',
      dateExpiring: '2026-05-28',
      plannedDate: '2026-05-30',
    },
  ]
}

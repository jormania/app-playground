/**
 * The demo forest. In **app shape** (not Notion page shape), following Fit
 * Check's `models/demoData.ts` convention — this is what `store.ts` serves
 * when no token is set, so the app is fully usable before a single Notion
 * database exists.
 *
 * Dates are computed relative to today rather than hardcoded, so the
 * understory's season-expiry fade always demos correctly regardless of when
 * this is run — including one row deliberately past the default 90-day
 * season, to exercise expiry on first load.
 */

import type { Thing } from './notion'
import type { Source } from './sources'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** The Sources the demo Things above already reference by id. */
export const DEMO_SOURCES: Source[] = [
  {
    id: 'demo-source-meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    kind: 'Book',
    cover: null,
    koboVolumeId: null,
    notes: '',
  },
  {
    id: 'demo-source-aristotle',
    title: 'Nicomachean Ethics',
    author: 'Aristotle',
    kind: 'Book',
    cover: null,
    koboVolumeId: null,
    notes: '',
  },
  {
    id: 'demo-source-conversation',
    title: 'A friend, on a walk',
    author: '',
    kind: 'Conversation',
    cover: null,
    koboVolumeId: null,
    notes: '',
  },
]

export const DEMO_THINGS: Thing[] = [
  {
    id: 'demo-thing-1',
    handle: 'You have power over your mind',
    body: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    kind: 'Passage',
    state: 'Kept',
    sourceId: 'demo-source-meditations',
    locator: 'Book VI',
    encountered: daysAgo(410),
    kept: daysAgo(395),
    note: 'Read this the week everything felt out of control. Still true.',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: 'kobo-demo-1',
  },
  {
    id: 'demo-thing-2',
    handle: 'The dog on the tram stop, waiting',
    body: 'A dog sat at the tram stop for twenty minutes, watching every door open and close, waiting for someone who never came.',
    kind: 'Observation',
    state: 'Kept',
    sourceId: null,
    locator: 'overheard on the 32 tram',
    encountered: daysAgo(120),
    kept: daysAgo(110),
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-3',
    handle: '"What would you do if you weren\'t afraid?"',
    body: '"What would you do if you weren\'t afraid?" "Probably the same thing. I\'d just enjoy it more."',
    kind: 'Dialogue',
    state: 'Kept',
    sourceId: 'demo-source-conversation',
    locator: '',
    encountered: daysAgo(60),
    kept: daysAgo(58),
    note: 'A friend said the second line without thinking. It stopped me.',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-4',
    handle: 'Is a forest still a forest with one tree?',
    body: 'Is a forest still a forest with one tree, or does the word describe the relation between trees rather than the trees themselves?',
    kind: 'Question',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: daysAgo(200),
    kept: daysAgo(180),
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-5',
    handle: 'draft — on keeping a forest instead of a library',
    body: 'A library is organized so you can find what you already know you want. A forest is organized so you can find what you didn\'t know you were looking for. Most of what I\'ve built has been libraries.',
    kind: 'Mine',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: daysAgo(3),
    kept: daysAgo(3),
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-6',
    handle: 'we are what we repeatedly do',
    body: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    kind: 'Fragment',
    state: 'Understory',
    sourceId: 'demo-source-aristotle',
    locator: '',
    encountered: daysAgo(5),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: 'kobo-demo-6',
  },
  {
    id: 'demo-thing-7',
    handle: 'the smell of rain on hot pavement has a name',
    body: 'The smell of rain on hot pavement has a name: petrichor. Someone had to notice it enough to name it.',
    kind: null,
    state: 'Understory',
    sourceId: null,
    locator: '',
    encountered: daysAgo(20),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-8',
    handle: 'can a memory be homesick for a place that never existed',
    body: 'Can a memory be homesick for a place that never existed — a composite of a dozen kitchens that feels more like home than any one of them was?',
    kind: 'Question',
    state: 'Understory',
    sourceId: null,
    locator: '',
    encountered: daysAgo(85),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
  },
  {
    id: 'demo-thing-9',
    handle: 'a link with no annotation, just the pull of it',
    body: 'A link with no annotation yet — just the pull of it.',
    kind: 'Link',
    state: 'Understory',
    sourceId: null,
    locator: '',
    encountered: daysAgo(95),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: 'https://example.com/an-essay-worth-keeping',
    koboBookmarkId: null,
  },
]

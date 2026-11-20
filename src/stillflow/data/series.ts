import type { SeriesDef } from '../domain/types'

/**
 * Adriene's January journeys and shorter series, as published. Only what was
 * checked against a source is here: the name, the year, how many practices it
 * has, and a sourceUrl for each. No day titles and no video ids, because those
 * weren't verifiable from here. Each day of a series comes alive when a session
 * in the catalogue carries the series name and a day number (import a `series`
 * and `seriesDay` column, or link one by hand). Until then the day opens a
 * YouTube search for "Yoga With Adriene <name> Day <n>".
 *
 * Years follow Yoga With Adriene's own list (do.yogawithadriene.com FAQ):
 * FLOW 2024, CENTER 2023, MOVE 2022, BREATH 2021, HOME 2020, Dedicate 2019,
 * TRUE 2018, Revolution 2017, Yoga Camp 2016, 30 Days of Yoga 2015.
 */

const FAQ = 'https://do.yogawithadriene.com/30-days-of-yoga-daily-emails'

const journey = (
  id: string, name: string, year: number, blurb: string, sourceUrl: string, extra: Partial<SeriesDef> = {},
): SeriesDef => ({
  id, name, year, length: 30, unit: 'Day', kind: 'journey', blurb, sourceUrl,
  match: [name.toLowerCase()], instructor: 'Yoga With Adriene', ...extra,
})

export const BUILT_IN_SERIES: SeriesDef[] = [
  {
    id: 'return-2026', name: 'RETURN', year: 2026, length: 4, unit: 'Week', kind: 'short',
    blurb: 'A January series of four practices, one released each weekend, to take on whichever day of that week suits you.',
    sourceUrl: 'https://www.fitandwell.com/wellness/yoga/ive-been-doing-yoga-with-adrienes-january-programmes-for-10-years-heres-why-i-think-the-just-announced-2026-series-is-great-for-beginners',
    match: ['return'], instructor: 'Yoga With Adriene',
  },
  {
    id: 'prana-2025', name: 'PRANA', year: 2025, length: 7, unit: 'Day', kind: 'short',
    blurb: 'A seven-day journey for the start of the year: one new practice a day for a week.',
    sourceUrl: 'https://www.fitandwell.com/news/the-internets-favorite-yoga-instructor-announces-a-seven-day-challenge-and-its-the-perfect-way-to-start-the-new-year',
    match: ['prana'], instructor: 'Yoga With Adriene',
  },
  journey('flow-2024', 'FLOW', 2024, 'The tenth January journey: using practice to steady and guide your energy, towards balanced momentum.', 'https://do.yogawithadriene.com/flow'),
  journey('center-2023', 'CENTER', 2023, 'Yoga for the here and now, designed with whole-body mental health in mind.', 'https://do.yogawithadriene.com/center'),
  journey('move-2022', 'MOVE', 2022, 'Movement as a way to process, build tone, release stress and lift the mood.', 'https://do.yogawithadriene.com/move'),
  journey('breath-2021', 'BREATH', 2021, 'Thirty days of conscious breath and movement.', 'https://yogawithadriene.com/breath-a-30-day-yoga-journey/'),
  journey('home-2020', 'HOME', 2020, 'An invitation to discover, and rediscover, how good it feels to come home to practice.', 'https://do.yogawithadriene.com/home'),
  journey('dedicate-2019', 'Dedicate', 2019, 'Turning tired energy into useful energy, and finding your own rhythm.', 'https://yogawithadriene.com/dedicate-a-30-day-yoga-journey/'),
  journey('true-2018', 'TRUE', 2018, 'A home journey that circles back to the true you.', 'https://do.yogawithadriene.com/true'),
  journey('revolution-2017', 'Revolution', 2017, 'Thirty-one days, often suggested for a more established practice.', 'https://fwfg.com/categories/30-days-of-yoga', { length: 31 }),
  journey('yoga-camp-2016', 'Yoga Camp', 2016, 'The 2016 January journey, thirty days long.', FAQ),
  journey('30-days-2015', '30 Days of Yoga', 2015, 'The original January journey, and a gentle place to begin.', FAQ, { match: ['30 days of yoga'] }),
]

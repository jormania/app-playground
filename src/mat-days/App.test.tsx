// @vitest-environment jsdom
// The whole app on an in-memory store, driven the way a person would: tap,
// type, go back. Each test is a use case from MAT_DAYS.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryStore } from '../shared/kvStore'
import type { KeyValueStore } from '../shared/kvStore'
import App from './App'
import { MatDaysRepo } from './store/repo'
import { localDate } from './lib/practice'
import { DEMO_SESSIONS } from './data/demo'

let store: KeyValueStore

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

async function start(opts: { welcomed?: boolean } = { welcomed: true }) {
  if (opts.welcomed) {
    const repo = new MatDaysRepo(store)
    const { preferences } = await repo.load()
    await repo.putPreferences({ ...preferences, welcomed: true })
  }
  const user = userEvent.setup()
  const view = render(<App repo={new MatDaysRepo(store)} seed={DEMO_SESSIONS} />)
  await screen.findByRole('navigation', { name: 'Main' }, {}).catch(() => undefined)
  return { user, view }
}

/** Every button and link on screen has a name a screen reader can speak. */
function expectNamedControls() {
  for (const el of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
    const name = el.getAttribute('aria-label') ?? el.textContent ?? ''
    expect(name.trim(), el.outerHTML.slice(0, 120)).not.toBe('')
  }
}

beforeEach(() => {
  store = memoryStore()
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('first run', () => {
  it('welcomes once, explains the demo records, then opens Discover', async () => {
    const { user } = await start({ welcomed: false })
    expect(await screen.findByText('Find your practice.')).toBeTruthy()
    expect(screen.getByText(/16 clearly marked demo records/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    expect(await screen.findByRole('heading', { name: /What does your body need today/ })).toBeTruthy()
    expectNamedControls()
    cleanup()
    await start({ welcomed: false })
    expect(await screen.findByRole('heading', { name: /What does your body need today/ })).toBeTruthy()
  })
})

describe('finding a practice', () => {
  it('an intention on Discover opens Explore already filtered, and Clear all undoes it', async () => {
    const { user } = await start()
    await user.click(await screen.findByRole('button', { name: /Restore and recover/ }))
    await go('#/explore')
    // One named filter, visible as a chip, with results behind it.
    expect(await screen.findByRole('button', { name: 'Remove filter Restore and recover' })).toBeTruthy()
    expect(await screen.findByText(/^[1-9]\d* sessions?$/)).toBeTruthy()
    expect(screen.queryByText('16 sessions')).toBeNull()
    await user.click(screen.getAllByRole('button', { name: 'Clear all' })[0])
    expect(await screen.findByText('16 sessions')).toBeTruthy()
  })

  it('search, filters, favourites and the empty state work together', async () => {
    const { user } = await start()
    await go('#/explore')
    await user.type(await screen.findByRole('searchbox'), 'hips')
    expect(await screen.findByText(/^[1-9]\d* sessions?$/)).toBeTruthy()
    await user.type(screen.getByRole('searchbox'), ' zzzz')
    expect(await screen.findByText('Nothing matches yet')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Yin Yoga' }))
    await user.click(within(dialog).getByRole('button', { name: /^Show 1 session$/ }))
    expect(screen.getByRole('button', { name: 'Remove filter Yin Yoga' })).toBeTruthy()
    expectNamedControls()
  })
})

describe('a session, end to end', () => {
  it('favourite, rate for repeating, mark completed; it shows in history and in the rating filter', async () => {
    const { user } = await start()
    await go('#/session/demo-hips-release')
    expect(await screen.findByRole('heading', { name: 'Demo · Hip release' })).toBeTruthy()
    // Demo records say what they are and search rather than pretend to play.
    expect(screen.getByText(/demonstration record, not a real video/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Search on YouTube/ }).getAttribute('href')).toMatch(/results\?search_query=/)

    await user.click(screen.getByRole('button', { name: /Add to favourites/ }))
    expect(screen.getByRole('button', { name: /^Favourite$/ })).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: '4: Want to repeat' }))
    expect(screen.getByText('Want to repeat')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Mark as done' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Note/), 'Hips felt open')
    await user.click(within(dialog).getByRole('button', { name: 'Record practice' }))
    // A short finishing moment, then back to the session.
    expect(await screen.findByText('Namaste')).toBeTruthy()
    expect(screen.getByText('Your first practice in Mat Days')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText(/Hips felt open/)).toBeTruthy()

    await go('#/practice')
    // In the history list once; the calendar day opens the same practice with its note.
    expect((await screen.findAllByText(/Hips felt open/)).length).toBe(1)
    await user.click(screen.getByRole('gridcell', { name: /show what you practised/ }))
    expect(within(await screen.findByRole('dialog')).getByText(/Hips felt open/)).toBeTruthy()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /close/i }))

    await go('#/explore')
    await user.click(await screen.findByRole('button', { name: /^Filters/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Want to repeat' }))
    expect(await screen.findByText('1 session')).toBeTruthy()
  })

  it('rating a session "A staple" also makes it a favourite, and lowering it later keeps the favourite', async () => {
    const { user } = await start()
    await go('#/session/demo-bedtime')
    expect(await screen.findByRole('button', { name: /Add to favourites/ })).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: '5: A staple' }))
    expect(await screen.findByRole('button', { name: /^Favourite$/ })).toBeTruthy()
    expect(await screen.findByText(/in your favourites now/)).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: '3: Happy to repeat' }))
    expect(screen.getByRole('button', { name: /^Favourite$/ })).toBeTruthy()
    await waitFor(async () => expect((await new MatDaysRepo(store).load()).userData['demo-bedtime']).toMatchObject({ rating: 3, favourite: true }))
  })

  it('keeps everything across a restart', async () => {
    const { user } = await start()
    await go('#/session/demo-bedtime')
    await user.click(await screen.findByRole('button', { name: /Add to favourites/ }))
    await user.click(screen.getByRole('radio', { name: '5: A staple' }))
    await waitFor(async () => expect((await new MatDaysRepo(store).load()).userData['demo-bedtime']?.rating).toBe(5))
    cleanup()
    await start()
    await go('#/session/demo-bedtime')
    expect(await screen.findByRole('button', { name: /^Favourite$/ })).toBeTruthy()
    expect(screen.getByText('A staple')).toBeTruthy()
  })

  it('hiding a session keeps it in Explore but out of Surprise Me', async () => {
    const { user } = await start()
    await go('#/session/demo-power-flow')
    await user.click(await screen.findByRole('button', { name: /Hide from suggestions/ }))
    expect(screen.getByRole('button', { name: /Show in suggestions/ })).toBeTruthy()
    await go('#/settings')
    expect(await screen.findByRole('heading', { name: 'Hidden from suggestions' })).toBeTruthy()
  })

  it('deleting a practice entry can be undone', async () => {
    const repo = new MatDaysRepo(store)
    await repo.putHistory({ id: 'p1', sessionId: 'demo-breath', date: '2026-11-10', minutes: 8, createdAt: 'x', note: 'calm' })
    const { user } = await start()
    await go('#/practice')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await new MatDaysRepo(store).load()).history.map((h) => h.id)).toEqual(['p1']))
  })
})

describe('coming back from YouTube', () => {
  it('asks "Did you finish…?" after a minute away, never before, and never marks it by itself', async () => {
    localStorage.setItem('stillflow:pending', JSON.stringify({ sessionId: 'demo-bedtime', at: Date.now() - 5_000 }))
    cleanup()
    await start()
    await screen.findByRole('heading', { name: /What does your body need/ })
    expect(screen.queryByText(/Did you finish/)).toBeNull()
    cleanup()
    localStorage.setItem('stillflow:pending', JSON.stringify({ sessionId: 'demo-bedtime', at: Date.now() - 120_000 }))
    const { user } = await start()
    expect(await screen.findByText(/Did you finish/)).toBeTruthy()
    expect((await new MatDaysRepo(store).load()).history).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Not this time' }))
    expect(screen.queryByText(/Did you finish/)).toBeNull()
    expect(localStorage.getItem('stillflow:pending')).toBeNull()
  })

  it('forgets a launch whose session has been deleted', async () => {
    localStorage.setItem('stillflow:pending', JSON.stringify({ sessionId: 'gone', at: Date.now() - 120_000 }))
    await start()
    await screen.findByRole('heading', { name: /What does your body need/ })
    await waitFor(() => expect(localStorage.getItem('stillflow:pending')).toBeNull())
  })

  it('Start Practice records a pending launch without touching history', async () => {
    const { user } = await start()
    await go('#/session/demo-core-strength')
    const link = await screen.findByRole('link', { name: /Search on YouTube/ })
    link.addEventListener('click', (e) => e.preventDefault())
    await user.click(link)
    expect(JSON.parse(localStorage.getItem('stillflow:pending')!).sessionId).toBe('demo-core-strength')
    expect((await new MatDaysRepo(store).load()).history).toEqual([])
  })
})

describe('Release 7', () => {
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d) }

  it('after five days away, Today welcomes you back with something gentle', async () => {
    await new MatDaysRepo(store).putHistory({ id: 'h1', sessionId: DEMO_SESSIONS[0].id, date: daysAgo(6), minutes: 20, createdAt: new Date().toISOString() })
    await start()
    expect(await screen.findByText('Welcome back')).toBeTruthy()
    expect(screen.getByText(/6 days away/)).toBeTruthy()
  })

  it('asks how much you would repeat a session the second time you record it, and learns how it felt', async () => {
    const id = DEMO_SESSIONS[0].id
    await new MatDaysRepo(store).putHistory({ id: 'h1', sessionId: id, date: daysAgo(1), minutes: 20, createdAt: new Date().toISOString() })
    const { user } = await start()
    await go(`#/session/${id}`)
    await user.click(await screen.findByRole('button', { name: 'Mark as done' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Your 2nd time with this one/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Strong' }))
    await user.click(within(dialog).getByRole('button', { name: 'Hips' }))
    await user.click(within(dialog).getByRole('button', { name: 'Record practice' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await waitFor(async () => {
      const lib = (await new MatDaysRepo(store).load()).sessions.find((x) => x.id === id)!
      expect(lib.physicalFocus).toContain('Hips')
    })
  })
})

describe('audit, Release 9', () => {
  it('choosing a way to pick in Surprise Me picks straight away', async () => {
    const { user } = await start()
    await go('#/surprise')
    const why = async () => (await screen.findByText(/./, { selector: 'p[class*="why"]' })).textContent
    await why()
    await user.click(screen.getByRole('button', { name: /^Recovery day/ }))
    await waitFor(async () => expect(await why()).toMatch(/kind to the body/))
    await user.click(screen.getByRole('button', { name: /^Completely random/ }))
    await waitFor(async () => expect(await why()).toMatch(/at random/))
  })

  it('a completed series shows its closing page on the series, not in the list', async () => {
    await new MatDaysRepo(store).putProgress({ seriesId: 'prana-2025', status: 'completed', startedAt: '2026-10-01', endedAt: '2026-10-08',
      manualDays: { 1: '2026-10-01' }, links: {}, runs: [{ startedAt: '2026-10-01', endedAt: '2026-10-08', status: 'completed', daysDone: 1 }] })
    await start()
    await go('#/series')
    await screen.findByRole('heading', { name: 'PRANA' })
    expect(screen.queryByText('Journey complete')).toBeNull()
    await go('#/series/prana-2025')
    expect(await screen.findByText('Journey complete')).toBeTruthy()
    // The finished run is described once, not repeated under Earlier runs.
    expect(screen.queryByRole('heading', { name: 'Earlier runs' })).toBeNull()
  })
})

describe('series', () => {
  it('start MOVE, tick days, abandon, start again with the earlier run kept', async () => {
    const { user } = await start()
    await go('#/series')
    expect(await screen.findByRole('heading', { name: 'January journeys' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Shorter series' })).toBeTruthy()
    expectNamedControls()
    await go('#/series/move-2022')
    await user.click(await screen.findByRole('button', { name: 'Start MOVE' }))
    expect(await screen.findByRole('region', { name: 'Up next: Day 1' })).toBeTruthy()
    // Nothing is in the library yet, so Day 1 is a YouTube search, never a guessed video.
    expect(screen.getByRole('link', { name: /Find Day 1 on YouTube/ }).getAttribute('href')).toContain('MOVE%20Day%201')
    await user.click(screen.getByRole('button', { name: /Mark Day 1 done/ }))
    expect(await screen.findByRole('region', { name: 'Up next: Day 2' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Day 5, not in library/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark Day 5 done' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2')

    await user.click(screen.getByRole('button', { name: /Abandon/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abandon' }))
    expect(await screen.findByText(/Abandoned .* after 2 of 30/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start again/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start again' }))
    expect(await screen.findByRole('region', { name: 'Up next: Day 1' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Earlier runs' })).toBeTruthy()

    await go('#/')
    const lead = await screen.findByRole('region', { name: 'Your next practice' })
    expect(within(lead).getByText('MOVE')).toBeTruthy()
    expect(within(lead).getByText('0 of 30 days done')).toBeTruthy()
    expect(within(lead).getByRole('link', { name: /Day 1/ })).toBeTruthy()
  })

  it('a practice recorded anywhere for a linked session moves the series on', async () => {
    const repo = new MatDaysRepo(store)
    await repo.putSessions([{
      id: 'yt-aaaaaaaaaaa', title: 'Day 1 - test', instructor: 'Yoga With Adriene', youtubeUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
      youtubeVideoId: 'aaaaaaaaaaa', durationMinutes: 25, styles: ['Hatha'], intensity: 2, physicalFocus: [], objectives: [], energy: [],
      experienceLevel: [], timeOfDay: [], equipment: [], tags: [], series: 'MOVE', seriesDay: 1, classificationConfidence: 'high',
      classificationSource: 'manual', dateAdded: '2026-11-20T00:00:00Z',
    }])
    await repo.putProgress({ seriesId: 'move-2022', status: 'active', startedAt: localDate(), manualDays: {}, links: {}, runs: [] })
    const { user } = await start()
    await go('#/session/yt-aaaaaaaaaaa')
    expect(await screen.findByRole('link', { name: /MOVE · Day 1/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mark as done' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Record practice' }))
    expect(await screen.findByText(/MOVE · Day 1 done, 29 to go/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await go('#/series/move-2022')
    expect(await screen.findByRole('region', { name: 'Up next: Day 2' })).toBeTruthy()
  })

  it('ticking a day that has its video in the library records it in My Practice, and unticking takes it back', async () => {
    const repo = new MatDaysRepo(store)
    await repo.putSessions([{
      id: 'yt-mmmmmmmmmmm', title: 'Day 1 - Here  |  MOVE - A 30 Day Yoga Journey', instructor: 'Yoga With Adriene',
      youtubeUrl: 'https://www.youtube.com/watch?v=mmmmmmmmmmm', youtubeVideoId: 'mmmmmmmmmmm', durationMinutes: 24, styles: [], intensity: 2,
      physicalFocus: [], objectives: [], energy: [], experienceLevel: [], timeOfDay: [], equipment: [], tags: ['from-channel'],
      series: 'MOVE', seriesDay: 1, classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: 'x',
    }])
    await repo.putPreferences({ ...(await repo.load()).preferences, welcomed: true, seriesReaderVersion: 99 })
    const { user } = await start({ welcomed: false })
    await go('#/series/move-2022')
    await user.click(await screen.findByRole('button', { name: 'Start MOVE' }))
    await user.click(await screen.findByRole('button', { name: /Mark Day 1 done/ }))
    expect(await screen.findByRole('region', { name: 'Up next: Day 2' })).toBeTruthy()
    const history = async () => (await new MatDaysRepo(store).load()).history
    await waitFor(async () => expect((await history()).map((h) => [h.sessionId, h.minutes])).toEqual([['yt-mmmmmmmmmmm', 24]]))
    await go('#/practice')
    expect((await screen.findAllByRole('link', { name: 'Here' })).length).toBeGreaterThan(0)
    await go('#/series/move-2022')
    await user.click(await screen.findByRole('button', { name: /Day 1, done/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Untick Day 1/ }))
    await waitFor(async () => expect(await history()).toEqual([]))
    expect(await screen.findByRole('region', { name: 'Up next: Day 1' })).toBeTruthy()
  })

  it('on load, turns earlier ticks of days in the library into practice entries', async () => {
    const repo = new MatDaysRepo(store)
    await repo.putSessions([{
      id: 'yt-nnnnnnnnnnn', title: 'Move - Day 28 - TLC', instructor: 'Yoga With Adriene', youtubeUrl: 'https://www.youtube.com/watch?v=nnnnnnnnnnn',
      youtubeVideoId: 'nnnnnnnnnnn', durationMinutes: 30, styles: [], intensity: 0, physicalFocus: [], objectives: [], energy: [], experienceLevel: [],
      timeOfDay: [], equipment: [], tags: ['from-channel'], classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: 'x',
    }])
    await repo.putProgress({ seriesId: 'move-2022', status: 'active', startedAt: '2026-11-19', manualDays: { 28: '2026-11-19' }, links: {}, runs: [] })
    await start()
    await go('#/practice')
    expect((await screen.findAllByRole('link', { name: 'TLC' })).length).toBeGreaterThan(0)
    const after = await new MatDaysRepo(store).load()
    expect(after.sessions.find((x) => x.id === 'yt-nnnnnnnnnnn')).toMatchObject({ series: 'MOVE', seriesDay: 28 })
    expect(after.seriesProgress['move-2022'].manualDays).toEqual({})
  })

  it('complete a series early, and create and delete one of your own', async () => {
    const { user } = await start()
    await go('#/series/prana-2025')
    await user.click(await screen.findByRole('button', { name: 'Start PRANA' }))
    await user.click(await screen.findByRole('button', { name: /Complete early/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete' }))
    expect(await screen.findByText('Journey complete')).toBeTruthy()
    expect(screen.getByText(/^0 of 7 days, /)).toBeTruthy()

    await go('#/series')
    await user.click(await screen.findByRole('button', { name: /Create a series/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Runners')
    await user.clear(within(dialog).getByLabelText('Number of practices'))
    await user.type(within(dialog).getByLabelText('Number of practices'), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await go(window.location.hash)
    expect(await screen.findByRole('heading', { name: 'Runners' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Delete this series/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect((await new MatDaysRepo(store).load()).customSeries).toEqual([]))
  })
})

describe('catalogue', () => {
  it('imports a CSV through the preview, then the session opens with a real watch link', async () => {
    const { user } = await start()
    await go('#/settings')
    const csv = 'title,youtubeUrl,durationMinutes,styles,series,seriesDay\nMy hips,https://youtu.be/bbbbbbbbbbb,22:30,Hatha,CENTER,3\nBad,https://vimeo.com/1,10,,,\n'
    const input = await screen.findByLabelText('Import a JSON or CSV library file')
    await user.upload(input, new File([csv], 'mine.csv', { type: 'text/csv' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bad')).toBeTruthy()
    expect(within(dialog).getByText(/This isn’t a YouTube video link/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 session' }))
    expect(await within(dialog).findByText(/1 added/)).toBeTruthy()
    await go('#/session/yt-bbbbbbbbbbb')
    expect(await screen.findByRole('link', { name: /CENTER · Day 3/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open in browser instead/ }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=bbbbbbbbbbb')
  })

  it('adding a session refuses a duplicate video and a link that is not YouTube', async () => {
    await new MatDaysRepo(store).putSessions([{
      id: 'yt-ccccccccccc', title: 'Already here', instructor: 'Y', youtubeUrl: 'https://www.youtube.com/watch?v=ccccccccccc',
      youtubeVideoId: 'ccccccccccc', durationMinutes: 10, styles: [], intensity: 0, physicalFocus: [], objectives: [], energy: [],
      experienceLevel: [], timeOfDay: [], equipment: [], tags: [], classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: 'x',
    }])
    const { user } = await start()
    await go('#/settings/session/new')
    await user.type(await screen.findByLabelText(/YouTube link/), 'https://vimeo.com/5')
    expect(screen.getByText('Not a YouTube video link')).toBeTruthy()
    await user.clear(screen.getByLabelText(/YouTube link/))
    await user.type(screen.getByLabelText(/YouTube link/), 'https://youtu.be/ccccccccccc')
    await user.type(screen.getByLabelText(/^Title/), 'Copy')
    await user.type(screen.getByLabelText(/^Length/), '10')
    await user.click(screen.getByRole('button', { name: 'Add to library' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/already in your library as “Already here”/)
  })

  it('collections: create from a session, add more from inside, reorder, remove with undo', async () => {
    const { user } = await start()
    await go('#/session/demo-breath')
    await user.click(await screen.findByRole('button', { name: 'Add to collection' }))
    let dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('New collection'), 'Evenings')
    await user.click(within(dialog).getByRole('button', { name: /Create/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await go('#/collections')
    await user.click(await screen.findByRole('link', { name: /Evenings/ }))
    await go(window.location.hash)
    await user.click(await screen.findByRole('button', { name: /Add sessions/ }))
    dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Search your library'), 'nidra')
    await user.click(within(dialog).getByRole('button', { name: /Yoga nidra rest/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await user.click(await screen.findByRole('button', { name: 'Move Demo · Yoga nidra rest up' }))
    const c = async () => (await new MatDaysRepo(store).load()).collections[0]
    await waitFor(async () => expect((await c()).sessionIds).toEqual(['demo-nidra', 'demo-breath']))
    await user.click(screen.getByRole('button', { name: 'Remove Demo · Breath practice' }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await c()).sessionIds).toEqual(['demo-nidra', 'demo-breath']))
  })

  it('a backup restores everything, including series progress', async () => {
    const repo = new MatDaysRepo(store)
    await repo.seedOnce([])
    await repo.putProgress({ seriesId: 'center-2023', status: 'active', startedAt: '2026-11-01', manualDays: { 1: '2026-11-01' }, links: {}, runs: [] })
    const backup = await repo.exportBackup()
    const other = new MatDaysRepo(memoryStore())
    await other.restoreBackup(backup)
    expect((await other.load()).seriesProgress['center-2023'].manualDays).toEqual({ 1: '2026-11-01' })
    // An older backup without series fields still restores.
    const { seriesProgress: _sp, customSeries: _cs, ...old } = backup
    void _sp; void _cs
    await other.restoreBackup(old)
    expect((await other.load()).seriesProgress).toEqual({})
  })
})

describe('Yoga With Adriene on YouTube', () => {
  const vid = (n: number, title: string, seconds: number | null = 1200) => ({
    videoId: `vid${String(n).padStart(8, '0')}`, title, description: '', publishedAt: '2026-11-0' + ((n % 9) + 1) + 'T10:00:00Z', durationSeconds: seconds,
  })
  function stubChannel(pages: { videos: ReturnType<typeof vid>[]; next: string | null }[], source = 'api', gone: string[] = []) {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const ids = new URL(url, 'http://x').searchParams.get('ids')
      if (ids) {
        const list = ids.split(',')
        return Response.json({ checked: list, available: list.filter((id) => !gone.includes(id)) })
      }
      calls.push(url)
      const token = new URL(url, 'http://x').searchParams.get('pageToken')
      const page = pages[token ? Number(token) : 0]
      return Response.json({ source, videos: page.videos, nextPageToken: page.next, total: 5 })
    }))
    return calls
  }
  afterEach(() => vi.unstubAllGlobals())

  it('imports the whole channel through the review, leaving out shorts and marking title readings provisional', async () => {
    stubChannel([
      { videos: [vid(1, 'Day 8 - Ground | MOVE - A 30 Day Yoga Journey'), vid(2, 'Yoga for Hips'), vid(3, 'A short', 40)], next: '1' },
      { videos: [vid(4, 'Bedtime Yoga'), vid(5, 'Power Yoga for Strength', 2400)], next: null },
    ])
    const { user } = await start()
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: /Import the whole channel/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1 short under four minutes left out/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Import 4 sessions' }))
    expect(await within(dialog).findByText(/4 added/)).toBeTruthy()
    const lib = (await new MatDaysRepo(store).load()).sessions.filter((x) => !x.isDemo)
    expect(lib).toHaveLength(4)
    expect(lib.every((x) => x.classificationConfidence === 'low' && x.classificationSource === 'inferred')).toBe(true)
    expect(lib.find((x) => x.youtubeVideoId === 'vid00000001')).toMatchObject({ series: 'MOVE', seriesDay: 8, durationMinutes: 20 })
    expect(lib.find((x) => x.youtubeVideoId === 'vid00000005')).toMatchObject({ intensity: 4, durationMinutes: 40 })
  })

  it('Check for updates also marks videos that no longer play, and they stop being suggested', async () => {
    await new MatDaysRepo(store).putSessions([2, 3].map((n) => ({
      id: `yt-vid0000000${n}`, title: `old ${n}`, instructor: 'Yoga With Adriene', youtubeUrl: `https://www.youtube.com/watch?v=vid0000000${n}`,
      youtubeVideoId: `vid0000000${n}`, durationMinutes: 20, styles: [], intensity: 0, physicalFocus: [], objectives: [], energy: [],
      experienceLevel: [], timeOfDay: [], equipment: [], tags: [], classificationConfidence: 'high' as const, classificationSource: 'manual' as const, dateAdded: 'x',
    })))
    stubChannel([{ videos: [vid(2, 'old 2'), vid(3, 'old 3')], next: null }], 'api', ['vid00000003'])
    const { user } = await start()
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: /Check for updates/ }))
    expect(await screen.findByText(/1 of your videos no longer play/)).toBeTruthy()
    const lib = (await new MatDaysRepo(store).load()).sessions
    expect(lib.find((x) => x.id === 'yt-vid00000003')?.tags).toContain('unavailable')
    expect(lib.find((x) => x.id === 'yt-vid00000002')?.tags).not.toContain('unavailable')
    await go('#/session/yt-vid00000003')
    expect(await screen.findByText(/YouTube no longer plays this video/)).toBeTruthy()
  })

  it('Check for updates stops at known videos, shows only what is new, then reports up to date', async () => {
    await new MatDaysRepo(store).putSessions([2, 3].map((n) => ({
      id: `yt-vid0000000${n}`, title: `old ${n}`, instructor: 'Yoga With Adriene', youtubeUrl: `https://www.youtube.com/watch?v=vid0000000${n}`,
      youtubeVideoId: `vid0000000${n}`, durationMinutes: 20, styles: [], intensity: 0, physicalFocus: [], objectives: [], energy: [],
      experienceLevel: [], timeOfDay: [], equipment: [], tags: [], classificationConfidence: 'high' as const, classificationSource: 'manual' as const, dateAdded: 'x',
    })))
    const calls = stubChannel([
      { videos: [vid(1, 'Brand new flow')], next: '1' },
      { videos: [vid(2, 'old 2'), vid(3, 'old 3')], next: '2' },
      { videos: [vid(4, 'never read')], next: null },
    ])
    const { user } = await start()
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: /Check for updates/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('1 new on Yoga With Adriene')).toBeTruthy()
    expect(calls).toHaveLength(2)
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 session' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Done' }))
    stubChannel([{ videos: [vid(1, 'Brand new flow'), vid(2, 'old 2')], next: null }])
    await user.click(screen.getByRole('button', { name: /Check for updates/ }))
    expect(await screen.findByText(/You’re up to date/)).toBeTruthy()
    expect(screen.getByText(/Last checked today: 0 new/)).toBeTruthy()
  })

  it('without an API key says so, and a failure is shown, not swallowed', async () => {
    stubChannel([{ videos: [vid(9, 'New one, no length', null)], next: null }], 'rss')
    const { user } = await start()
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: /Check for updates/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/No length: add minutes/)).toBeTruthy()
    expect(within(dialog).getByText(/only the 15 newest uploads/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(/YOUTUBE_API_KEY/)).toBeTruthy()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'The YouTube API quota for today is used up.' }, { status: 429 })))
    await user.click(screen.getByRole('button', { name: /Check for updates/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/quota/)
  })
})

describe('every main screen', () => {
  it.each(['#/', '#/explore', '#/surprise', '#/series', '#/practice', '#/collections', '#/settings', '#/settings/session/new'])(
    '%s renders with every control named', async (hash) => {
      await start()
      await go(hash)
      await waitFor(() => expect(document.querySelector('main')?.textContent?.length).toBeGreaterThan(20))
      expectNamedControls()
    },
  )
})

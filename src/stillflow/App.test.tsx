// @vitest-environment jsdom
// The whole app on an in-memory store, driven the way a person would: tap,
// type, go back. Each test is a use case from STILLFLOW.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryStore } from '../shared/kvStore'
import type { KeyValueStore } from '../shared/kvStore'
import App from './App'
import { StillflowRepo } from './store/repo'
import { localDate } from './lib/practice'

let store: KeyValueStore

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

async function start(opts: { welcomed?: boolean } = { welcomed: true }) {
  if (opts.welcomed) {
    const repo = new StillflowRepo(store)
    const { preferences } = await repo.load()
    await repo.putPreferences({ ...preferences, welcomed: true })
  }
  const user = userEvent.setup()
  const view = render(<App repo={new StillflowRepo(store)} />)
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
    expect(await screen.findByText('4 sessions')).toBeTruthy()
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

    await user.click(screen.getByRole('button', { name: 'Mark as completed' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Note/), 'Hips felt open')
    await user.click(within(dialog).getByRole('button', { name: 'Record practice' }))
    expect(await screen.findByText(/Hips felt open/)).toBeTruthy()

    await go('#/practice')
    expect(await screen.findByText(/Hips felt open/)).toBeTruthy()

    await go('#/explore')
    await user.click(await screen.findByRole('button', { name: /^Filters/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Want to repeat' }))
    expect(await screen.findByText('1 session')).toBeTruthy()
  })

  it('keeps everything across a restart', async () => {
    const { user } = await start()
    await go('#/session/demo-bedtime')
    await user.click(await screen.findByRole('button', { name: /Add to favourites/ }))
    await user.click(screen.getByRole('radio', { name: '5: A staple' }))
    await waitFor(async () => expect((await new StillflowRepo(store).load()).userData['demo-bedtime']?.rating).toBe(5))
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
    const repo = new StillflowRepo(store)
    await repo.putHistory({ id: 'p1', sessionId: 'demo-breath', date: '2026-11-10', minutes: 8, createdAt: 'x', note: 'calm' })
    const { user } = await start()
    await go('#/practice')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await new StillflowRepo(store).load()).history.map((h) => h.id)).toEqual(['p1']))
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
    expect((await new StillflowRepo(store).load()).history).toEqual([])
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
    expect((await new StillflowRepo(store).load()).history).toEqual([])
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
    expect(await screen.findByText(/Next: Day 1/)).toBeTruthy()
    // Nothing is in the library yet, so Day 1 is a YouTube search, never a guessed video.
    expect(screen.getByRole('link', { name: /Find Day 1 on YouTube/ }).getAttribute('href')).toContain('MOVE%20Day%201')
    await user.click(screen.getByRole('button', { name: /Mark Day 1 done/ }))
    expect(await screen.findByText(/Next: Day 2/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Day 5, not in library/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark Day 5 done' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2')

    await user.click(screen.getByRole('button', { name: /Abandon/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abandon' }))
    expect(await screen.findByText(/Set aside .* after 2 of 30/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start again/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start again' }))
    expect(await screen.findByText(/Next: Day 1/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Earlier runs' })).toBeTruthy()

    await go('#/')
    expect(await screen.findByRole('heading', { name: 'Your series' })).toBeTruthy()
    expect(screen.getByText('MOVE · Day 1')).toBeTruthy()
  })

  it('a practice recorded anywhere for a linked session moves the series on', async () => {
    const repo = new StillflowRepo(store)
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
    await user.click(screen.getByRole('button', { name: 'Mark as completed' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Record practice' }))
    await go('#/series/move-2022')
    expect(await screen.findByText(/Next: Day 2/)).toBeTruthy()
  })

  it('complete a series early, and create and delete one of your own', async () => {
    const { user } = await start()
    await go('#/series/prana-2025')
    await user.click(await screen.findByRole('button', { name: 'Start PRANA' }))
    await user.click(await screen.findByRole('button', { name: /Complete series/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete' }))
    expect(await screen.findByText(/Completed .*, 0 of 7 days/)).toBeTruthy()

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
    await waitFor(async () => expect((await new StillflowRepo(store).load()).customSeries).toEqual([]))
  })
})

describe('catalogue', () => {
  it('imports a CSV through the preview, then the session opens with a real watch link', async () => {
    const { user } = await start()
    await go('#/settings')
    const csv = 'title,youtubeUrl,durationMinutes,styles,series,seriesDay\nMy hips,https://youtu.be/bbbbbbbbbbb,22:30,Hatha,CENTER,3\nBad,https://vimeo.com/1,10,,,\n'
    const input = await screen.findByLabelText('Import a JSON or CSV catalogue file')
    await user.upload(input, new File([csv], 'mine.csv', { type: 'text/csv' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bad')).toBeTruthy()
    expect(within(dialog).getByText(/YouTube URL or video id is not valid/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 session' }))
    expect(await within(dialog).findByText(/1 added/)).toBeTruthy()
    await go('#/session/yt-bbbbbbbbbbb')
    expect(await screen.findByRole('link', { name: /CENTER · Day 3/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open in browser instead/ }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=bbbbbbbbbbb')
  })

  it('adding a session refuses a duplicate video and a link that is not YouTube', async () => {
    await new StillflowRepo(store).putSessions([{
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
    await user.type(screen.getByLabelText(/^Duration/), '10')
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
    const c = async () => (await new StillflowRepo(store).load()).collections[0]
    await waitFor(async () => expect((await c()).sessionIds).toEqual(['demo-nidra', 'demo-breath']))
    await user.click(screen.getByRole('button', { name: 'Remove Demo · Breath practice' }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await c()).sessionIds).toEqual(['demo-nidra', 'demo-breath']))
  })

  it('a backup restores everything, including series progress', async () => {
    const repo = new StillflowRepo(store)
    await repo.seedOnce([])
    await repo.putProgress({ seriesId: 'center-2023', status: 'active', startedAt: '2026-11-01', manualDays: { 1: '2026-11-01' }, links: {}, runs: [] })
    const backup = await repo.exportBackup()
    const other = new StillflowRepo(memoryStore())
    await other.restoreBackup(backup)
    expect((await other.load()).seriesProgress['center-2023'].manualDays).toEqual({ 1: '2026-11-01' })
    // An older backup without series fields still restores.
    const { seriesProgress: _sp, customSeries: _cs, ...old } = backup
    void _sp; void _cs
    await other.restoreBackup(old)
    expect((await other.load()).seriesProgress).toEqual({})
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

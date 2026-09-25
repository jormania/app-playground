// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Shell } from './Shell'
import { GUIDE_URL } from './screens/Home'
import { EngagementLog } from './log'
import { ProfileRepo } from './profiles'
import { K, memoryStore, type KeyValueStore } from './store'

vi.mock('../App', () => ({ default: () => <div>probe screen</div> }))

beforeEach(() => {
  history.replaceState(null, '', '#/')
})
afterEach(cleanup)

async function start(store: KeyValueStore = memoryStore()) {
  render(<Shell store={store} />)
  return store
}

async function createPlayer(name: string) {
  fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: name } })
  fireEvent.click(screen.getByRole('radio', { name: '🦊' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create' }))
  await screen.findByText(`Hi, ${name}!`)
}

describe('KeyPath shell', () => {
  it('asks who’s playing on a new phone, and opens into that player next time', async () => {
    const store = await start()
    expect(await screen.findByText('Who’s playing?')).toBeTruthy()
    await createPlayer('Nora')
    cleanup()
    history.replaceState(null, '', '#/')
    await start(store)
    expect(await screen.findByText('Hi, Nora!')).toBeTruthy()
  })

  it('shows four doors, and logs which one she opens', async () => {
    const store = await start()
    await createPlayer('Nora')
    const doors = within(screen.getByRole('navigation'))
    for (const door of ['Songs', 'Journey', 'Challenges', 'Studio']) expect(doors.getByRole('button', { name: new RegExp(door) })).toBeTruthy()
    fireEvent.click(doors.getByRole('button', { name: /Challenges/ }))
    expect(await screen.findByText('Note race')).toBeTruthy()
    const [p] = await new ProfileRepo(store).list()
    const events = await new EngagementLog(store).read(p.id)
    expect(events.map((e) => e.type)).toEqual(['profile_created', 'session_start', 'door_opened'])
    expect(events[2]).toMatchObject({ door: 'challenges' })
  })

  it('switches the whole app to Romanian from settings, for that player only', async () => {
    const store = await start()
    await createPlayer('Nora')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Română' }))
    expect(await screen.findByText('Setări pentru Nora')).toBeTruthy()
    const [p] = await new ProfileRepo(store).list()
    expect((await new ProfileRepo(store).settings(p.id)).language).toBe('ro')
    expect((await new EngagementLog(store).read(p.id)).at(-1)).toMatchObject({ type: 'setting_changed', key: 'language', from: 'en', to: 'ro' })
  })

  it('reaches Diagnostics from settings, and switches player', async () => {
    await start()
    await createPlayer('Gabriel')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }))
    expect(await screen.findByText('probe screen')).toBeTruthy()
    await act(async () => {
      history.back()
      await new Promise((r) => setTimeout(r, 50))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Switch player' }))
    expect(await screen.findByText('Who’s playing?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Gabriel/ })).toBeTruthy()
  })

  it('ends a session when KeyPath leaves the screen, and starts one on return', async () => {
    const store = await start()
    await createPlayer('Nora')
    const setVisibility = (v: string) => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    setVisibility('hidden')
    setVisibility('visible')
    const [p] = await new ProfileRepo(store).list()
    await waitFor(async () => {
      expect((await new EngagementLog(store).read(p.id)).map((e) => e.type)).toEqual(['profile_created', 'session_start', 'session_end', 'session_start'])
    })
  })

  it('starts a new player on “Wait for it”, and turns the key names off from settings', async () => {
    const store = await start()
    await createPlayer('Nora')
    const [p] = await new ProfileRepo(store).list()
    expect((await new ProfileRepo(store).settings(p.id)).onWrong).toBe('wait')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Names on the keys' }))
    await waitFor(async () => expect((await new ProfileRepo(store).settings(p.id)).keyNames).toBe(false))
  })

  it('deletes a player only after confirming, and leaves the others', async () => {
    const store = await start()
    await createPlayer('Gabriel')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Switch player' }))
    fireEvent.click(await screen.findByRole('button', { name: /Add a player/ }))
    await createPlayer('Nora')
    const repo = new ProfileRepo(store)
    const nora = (await repo.list()).find((p) => p.name === 'Nora')!

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete this player' }))
    expect(screen.getByText(/Delete Nora and everything of theirs on this phone/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await repo.list()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Delete this player' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Nora' }))
    expect(await screen.findByText('Who’s playing?')).toBeTruthy()
    expect((await repo.list()).map((p) => p.name)).toEqual(['Gabriel'])
    // Nothing of hers comes back, not even a late session_end.
    await new EngagementLog(store).settled()
    expect((await store.keys()).filter((k) => k.includes(nora.id))).toEqual([])
  })
})

describe('KeyPath shell, after the audit', () => {
  it('creates a player in the language picked on the form, which speaks it as soon as it is picked', async () => {
    const store = await start()
    fireEvent.click(await screen.findByRole('radio', { name: 'Română' }))
    expect(screen.getByText('Cine cântă?')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^Nume/), { target: { value: 'Nora' } })
    fireEvent.click(screen.getByRole('button', { name: 'Creează' }))
    expect(await screen.findByText('Salut, Nora!')).toBeTruthy()
    const [p] = await new ProfileRepo(store).list()
    expect((await new ProfileRepo(store).settings(p.id)).language).toBe('ro')
  })

  it('edits a player’s name and face from settings', async () => {
    const store = await start()
    await createPlayer('Nora')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit name and face' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Nora B.' } })
    fireEvent.click(screen.getByRole('radio', { name: '🦉' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Settings for Nora B.')).toBeTruthy()
    expect((await new ProfileRepo(store).list())[0]).toMatchObject({ name: 'Nora B.', avatar: '🦉' })
  })

  it('asks before a restore on the page itself, not in a browser dialog', async () => {
    const confirm = vi.fn(() => true)
    window.confirm = confirm
    await start()
    await createPlayer('Nora')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const input = (await screen.findByText('Restore from a backup')).closest('div')!.querySelector('input[type=file]')!
    const file = new File(['{}'], 'keypath-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole('alertdialog', { name: 'Replace everything on this phone with this backup?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('Today: a song, a Journey step and a game, the song the one she is on, logged as opening its door', async () => {
    const store = await start()
    await createPlayer('Nora')
    const [p] = await new ProfileRepo(store).list()
    const log = new EngagementLog(store)
    await log.add(p.id, { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 2, score: 0.8, hit: 10, total: 12, wrong: 1 })
    // Today's picks are kept for the day; a new day makes new ones.
    await store.del(K.today(p.id))
    cleanup()
    history.replaceState(null, '', '#/')
    await start(store)
    const today = within(await screen.findByRole('region', { name: /Today/ }))
    // Finished today with two stars: still the one to play, and already ticked off.
    const song = today.getByRole('button', { name: /^A song: 🎵 Ode to Joy · done$/ })
    expect(today.getByRole('button', { name: /^A Journey step: 🗺️ Find middle C$/ })).toBeTruthy()
    expect(today.getByRole('button', { name: /^A quick game:/ })).toBeTruthy()
    fireEvent.click(song)
    await waitFor(async () => expect((await log.read(p.id)).at(-1)).toMatchObject({ type: 'door_opened', door: 'songs' }))
    expect(location.hash).toBe('#/play/starter%3Aode')
  })

  it('says which release this is at the foot of Settings', async () => {
    await start()
    await createPlayer('Nora')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByText('KeyPath, release 1')).toBeTruthy()
  })

  it('links the user’s guide from the top of Home, in a new tab', async () => {
    await start()
    await createPlayer('Nora')
    const guide = screen.getByRole('link', { name: 'User’s guide' })
    expect(guide.getAttribute('href')).toBe(GUIDE_URL)
    expect(guide.getAttribute('target')).toBe('_blank')
    expect(guide.getAttribute('rel')).toContain('noopener')
  })

  it('Today all done is noted once, for its sticker', async () => {
    const store = await start()
    await createPlayer('Nora')
    const [p] = await new ProfileRepo(store).list()
    const log = new EngagementLog(store)
    await log.add(p.id, { type: 'song_finished', songId: 'starter:twinkle', practice: 'right', stars: 2, score: 0.8, hit: 10, total: 12, wrong: 1 })
    await log.add(p.id, { type: 'journey_finished', step: 'middleC', mode: 'practice', passed: true, wrong: 0, ms: 1 })
    for (const game of ['race', 'echo', 'chord'] as const) await log.add(p.id, { type: 'challenge_finished', game, level: 1, score: 3, best: false, ms: 1 })
    await store.del(K.today(p.id))
    const doneCount = async () => (await log.read(p.id)).filter((e) => e.type === 'today_done').length
    for (let visit = 0; visit < 2; visit++) {
      cleanup()
      history.replaceState(null, '', '#/')
      await start(store)
      expect(await screen.findByText('All done for today. See you tomorrow!')).toBeTruthy()
      await waitFor(async () => expect(await doneCount()).toBe(1))
    }
  })

  it('stickers: the earned ones in colour, a new one announced once', async () => {
    const store = await start()
    await createPlayer('Nora')
    const [p] = await new ProfileRepo(store).list()
    await new EngagementLog(store).add(p.id, { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 12, total: 12, wrong: 0 })
    cleanup()
    history.replaceState(null, '', '#/')
    await start(store)
    const shelf = within(await screen.findByRole('region', { name: /Stickers/ }))
    expect(shelf.getByText('2 of 23')).toBeTruthy()
    // Two at once (first song, three stars): counted, not named.
    expect(await shelf.findByText('2 new stickers! Tap one to see what it’s for.')).toBeTruthy()
    expect(shelf.getByRole('button', { name: 'Three stars on a song' }).getAttribute('data-earned')).toBe('true')
    expect(shelf.getByRole('button', { name: 'A tricky bar made clean · not yet' }).getAttribute('data-earned')).toBeNull()
    // Tapping one says what it's for.
    fireEvent.click(shelf.getByRole('button', { name: 'A tricky bar made clean · not yet' }))
    expect(shelf.getByText('A tricky bar made clean · not yet')).toBeTruthy()
    // Next time, nothing new.
    cleanup()
    await start(store)
    await screen.findByRole('region', { name: /Stickers/ })
    expect(screen.queryByText(/New sticker/)).toBeNull()
  })

  it('shows Progress dates the way people write them, once when it is all one day', async () => {
    await start()
    await createPlayer('Nora')
    act(() => {
      history.pushState(null, '', '#/progress')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(await screen.findByText('At a glance')).toBeTruthy()
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    expect(screen.getByText(today)).toBeTruthy()
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull()
  })
})

describe('KeyPath shell: time per door', () => {
  it('logs leaving a door when she is back on Home, and not for a detour to Settings', async () => {
    const store = await start()
    await createPlayer('Nora')
    fireEvent.click(screen.getByRole('button', { name: /Songs/ }))
    await screen.findByText('Starter songs')
    act(() => {
      history.pushState(null, '', '#/settings')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await screen.findByText('Settings for Nora')
    act(() => {
      history.pushState(null, '', '#/')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await screen.findByText('Hi, Nora!')
    const [p] = await new ProfileRepo(store).list()
    await waitFor(async () => {
      const types = (await new EngagementLog(store).read(p.id)).map((e) => e.type)
      expect(types.filter((x) => x === 'door_left')).toHaveLength(1)
    })
    expect((await new EngagementLog(store).read(p.id)).find((e) => e.type === 'door_left')).toMatchObject({ door: 'songs' })
  })
})

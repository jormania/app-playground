// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Shell } from './Shell'
import { EngagementLog } from './log'
import { ProfileRepo } from './profiles'
import { memoryStore, type KeyValueStore } from './store'

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
    for (const door of ['Songs', 'Journey', 'Challenges', 'Studio']) expect(screen.getByRole('button', { name: new RegExp(door) })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Challenges/ }))
    expect(await screen.findByText('Coming soon')).toBeTruthy()
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

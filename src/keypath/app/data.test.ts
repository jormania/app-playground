import { describe, expect, it } from 'vitest'
import { backupDue, BackupError, exportBackup, markBackedUp, restoreBackup } from './backup'
import { EngagementLog } from './log'
import { DEFAULT_PROFILE_SETTINGS, ProfileRepo } from './profiles'
import { K, memoryStore } from './store'
import { hrefOf, parseRoute } from './router'

describe('ProfileRepo', () => {
  it('creates players with confidence-first, English defaults', async () => {
    const repo = new ProfileRepo(memoryStore())
    const p = await repo.create('  Nora  ', '🐺')
    expect(p).toMatchObject({ name: 'Nora', avatar: '🐺' })
    expect(await repo.settings(p.id)).toEqual(DEFAULT_PROFILE_SETTINGS)
    expect(DEFAULT_PROFILE_SETTINGS).toMatchObject({ language: 'en', noteNames: 'auto', onWrong: 'show', timing: 'relaxed', report: 'short', wrongAffectsStars: false })
  })

  it('keeps each player’s settings apart', async () => {
    const repo = new ProfileRepo(memoryStore())
    const a = await repo.create('A', '🦊')
    const b = await repo.create('B', '🦉')
    await repo.saveSettings(a.id, { ...DEFAULT_PROFILE_SETTINGS, language: 'ro' })
    expect((await repo.settings(a.id)).language).toBe('ro')
    expect((await repo.settings(b.id)).language).toBe('en')
  })

  it('remembers which player this phone opens into', async () => {
    const repo = new ProfileRepo(memoryStore())
    const p = await repo.create('A', '🦊')
    expect(await repo.current()).toBeNull()
    await repo.setCurrent(p.id)
    expect((await repo.current())?.id).toBe(p.id)
  })

  it('fills in settings added after a player was created', async () => {
    const store = memoryStore()
    const repo = new ProfileRepo(store)
    const p = await repo.create('A', '🦊')
    await store.set(K.settings(p.id), { language: 'ro' }) // an older version's shape
    expect(await repo.settings(p.id)).toEqual({ ...DEFAULT_PROFILE_SETTINGS, language: 'ro' })
  })

  it('refuses a player with no name', async () => {
    await expect(new ProfileRepo(memoryStore()).create('   ', '🦊')).rejects.toThrow()
  })
})

describe('EngagementLog', () => {
  it('keeps every event, even when two are written at once', async () => {
    const log = new EngagementLog(memoryStore())
    await Promise.all([log.add('p', { type: 'session_start' }), log.add('p', { type: 'door_opened', door: 'songs' }), log.add('p', { type: 'door_opened', door: 'studio' })])
    expect((await log.read('p')).map((r) => r.type)).toEqual(['session_start', 'door_opened', 'door_opened'])
    expect((await log.read('p'))[1]).toMatchObject({ profileId: 'p', door: 'songs', at: expect.any(String) })
  })
})

describe('backup', () => {
  it('round-trips everything KeyPath keeps, and nothing else', async () => {
    const store = memoryStore({ 'someone-else:key': 1 })
    const repo = new ProfileRepo(store)
    const p = await repo.create('Nora', '🐺')
    await new EngagementLog(store).add(p.id, { type: 'profile_created' })
    const backup = await exportBackup(store)
    expect(Object.keys(backup.data).every((k) => k.startsWith('keypath:v1:'))).toBe(true)

    const fresh = memoryStore()
    expect(await restoreBackup(fresh, JSON.stringify(backup))).toBe(3)
    expect((await new ProfileRepo(fresh).list()).map((x) => x.name)).toEqual(['Nora'])
  })

  it('rejects a file that isn’t a KeyPath backup, and changes nothing', async () => {
    const store = memoryStore()
    await new ProfileRepo(store).create('A', '🦊')
    await expect(restoreBackup(store, 'not json')).rejects.toBeInstanceOf(BackupError)
    await expect(restoreBackup(store, '{"hello":1}')).rejects.toBeInstanceOf(BackupError)
    expect(await new ProfileRepo(store).list()).toHaveLength(1)
  })

  it('nudges a week after the first player, or a week after the last backup — never on day one', async () => {
    const store = memoryStore()
    const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n))
    expect(await backupDue(store, day(0))).toBe(false) // nothing to save
    await new ProfileRepo(store).create('A', '🦊', day(0))
    expect(await backupDue(store, day(3))).toBe(false)
    expect(await backupDue(store, day(8))).toBe(true)
    await markBackedUp(store, day(8))
    expect(await backupDue(store, day(10))).toBe(false)
    expect(await backupDue(store, day(16))).toBe(true)
  })
})

describe('router', () => {
  it('parses and builds every screen', () => {
    expect(parseRoute('')).toEqual({ name: 'start' })
    expect(parseRoute('#/home')).toEqual({ name: 'home' })
    expect(parseRoute('#/door/studio')).toEqual({ name: 'door', door: 'studio' })
    expect(parseRoute('#/door/nope')).toEqual({ name: 'home' })
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' })
    expect(hrefOf({ name: 'door', door: 'songs' })).toBe('#/door/songs')
    expect(hrefOf({ name: 'diagnostics' })).toBe('#/diagnostics')
  })

  it('round-trips the Songs screens, including song ids with a colon', () => {
    expect(parseRoute('#/songs')).toEqual({ name: 'door', door: 'songs' })
    expect(parseRoute(hrefOf({ name: 'songImport' }))).toEqual({ name: 'songImport' })
    expect(parseRoute(hrefOf({ name: 'play', songId: 'import:abc' }))).toEqual({ name: 'play', songId: 'import:abc' })
    expect(parseRoute('#/play/')).toEqual({ name: 'door', door: 'songs' })
    expect(parseRoute(hrefOf({ name: 'connect' }))).toEqual({ name: 'connect' })
    expect(parseRoute('#/journey')).toEqual({ name: 'door', door: 'journey' })
    expect(parseRoute('#/studio')).toEqual({ name: 'door', door: 'studio' })
    expect(parseRoute(hrefOf({ name: 'studio', songId: 'starter:ode' }))).toEqual({ name: 'studio', songId: 'starter:ode' })
    expect(parseRoute(hrefOf({ name: 'journeyStep', step: 'chord' }))).toEqual({ name: 'journeyStep', step: 'chord' })
  })
})

import { describe, expect, it } from 'vitest'
import { backupDue, BackupError, exportBackup, markBackedUp, restoreBackup } from './backup'
import { EngagementLog } from './log'
import { DEFAULT_PROFILE_SETTINGS, ProfileRepo } from './profiles'
import { exclusive, K, PREFIX, memoryStore, update } from './store'
import { TakeRepo } from './studio/takes'
import { markSeen, seenStickers } from './screens/stickers'
import { hrefOf, parseRoute } from './router'

describe('ProfileRepo', () => {
  it('deletes a player and everything that is theirs, and nothing that isn’t', async () => {
    const store = memoryStore()
    const repo = new ProfileRepo(store)
    const nora = await repo.create('Nora', '🐺')
    const gabriel = await repo.create('Gabriel', '🦉')
    await repo.setCurrent(nora.id)
    for (const p of [nora, gabriel]) {
      await store.set(K.log(p.id), [{ type: 'session_start' }])
      await store.set(K.journey(p.id), { middleC: { at: '', how: 'check' } })
      await store.set(K.studio(p.id), [])
    }
    await store.set(`${PREFIX}songs`, [{ id: 'import:x' }])
    await store.set(K.keyboard, { name: 'Digital Keyboard' })

    await repo.remove(nora.id)

    expect((await repo.list()).map((p) => p.name)).toEqual(['Gabriel'])
    expect(await repo.current()).toBeNull()
    const left = await store.keys()
    expect(left.filter((k) => k.includes(nora.id))).toEqual([])
    for (const k of [K.settings(gabriel.id), K.log(gabriel.id), K.journey(gabriel.id), K.studio(gabriel.id), `${PREFIX}songs`, K.keyboard]) expect(left).toContain(k)
  })

  it('creates players with confidence-first, English defaults', async () => {
    const repo = new ProfileRepo(memoryStore())
    const p = await repo.create('  Nora  ', '🐺')
    expect(p).toMatchObject({ name: 'Nora', avatar: '🐺' })
    expect(await repo.settings(p.id)).toEqual(DEFAULT_PROFILE_SETTINGS)
    expect(DEFAULT_PROFILE_SETTINGS).toMatchObject({ language: 'en', noteNames: 'auto', onWrong: 'wait', timing: 'relaxed', report: 'short', wrongAffectsStars: false })
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

  it('goes on after a write that fails: the next event is kept, and reading and settling still work', async () => {
    const store = memoryStore()
    let failNext = true
    const flaky = { ...store, set: async (k: string, v: unknown) => { if (failNext) { failNext = false; throw new Error('QuotaExceededError') } return store.set(k, v) } }
    const log = new EngagementLog(flaky)
    await expect(log.add('p', { type: 'session_start' })).rejects.toThrow('QuotaExceededError')
    await log.add('p', { type: 'door_opened', door: 'songs' })
    await expect(log.settled()).resolves.toBeUndefined()
    expect((await log.read('p')).map((r) => r.type)).toEqual(['door_opened'])
  })

  it('puts a full log away in chunks, so an append rewrites only the open one, and reads it all back in order', async () => {
    const store = memoryStore()
    const log = new EngagementLog(store, 3)
    for (let i = 0; i < 7; i++) await log.add('p', { type: 'door_opened', door: i % 2 ? 'songs' : 'studio' }, new Date(2026, 0, 1, 0, i))
    expect(await store.get(K.logArchive('p', 0))).toHaveLength(3)
    expect(await store.get(K.logArchive('p', 1))).toHaveLength(3)
    expect(await store.get(K.log('p'))).toHaveLength(1)
    const all = await log.read('p')
    expect(all.map((r) => new Date(r.at).getMinutes())).toEqual([0, 1, 2, 3, 4, 5, 6])
    // A player removed takes the chunks with them; a backup carries them.
    const backup = await exportBackup(store)
    expect(Object.keys(backup.data)).toContain(K.logArchive('p', 1))
    await new ProfileRepo(store).remove('p')
    expect((await store.keys()).sort()).toEqual([K.meta, K.profiles])
  })

  it('puts a long log from before chunking away whole on its next append, losing nothing', async () => {
    const at = new Date(2026, 0, 1).toISOString()
    const store = memoryStore({ [K.log('p')]: Array.from({ length: 5 }, () => ({ type: 'session_start', at, profileId: 'p' })) })
    const log = new EngagementLog(store, 3)
    await log.add('p', { type: 'today_done' })
    expect(await store.get(K.logArchive('p', 0))).toHaveLength(6)
    expect(await store.get(K.log('p'))).toEqual([])
    expect((await log.read('p')).map((r) => r.type)).toEqual([...Array(5).fill('session_start'), 'today_done'])
  })
})

describe('store: one change to a key at a time', () => {
  // A store whose reads take a moment, as IndexedDB's do: without the lock,
  // two changes started together both read the old value and one is lost.
  const slow = () => {
    const m = memoryStore()
    return { ...m, get: async <T,>(k: string) => { await new Promise((r) => setTimeout(r, 1)); return m.get<T>(k) } }
  }

  it('keeps both of two changes made at once, across separate repos on the same store', async () => {
    const store = slow()
    await Promise.all([update<number[]>(store, 'k', (a = []) => [...a, 1]), update<number[]>(store, 'k', (a = []) => [...a, 2])])
    expect(await store.get('k')).toEqual([1, 2])
    await Promise.all([markSeen(store, 'p', ['a']), markSeen(store, 'p', ['b'])])
    expect([...(await seenStickers(store, 'p'))].sort()).toEqual(['a', 'b'])
  })

  it('a favourite and a rename tapped together both stick', async () => {
    const store = slow()
    const take = await new TakeRepo(store).keep('p', { ms: 1000, notes: [], pedal: [] }, { style: false, bpm: 100 })
    await Promise.all([new TakeRepo(store).update('p', take!.id, { favourite: true }), new TakeRepo(store).rename('p', take!.id, 'Mine')])
    expect((await new TakeRepo(store).list('p'))[0]).toMatchObject({ favourite: true, name: 'Mine' })
  })

  it('goes on after a change that fails', async () => {
    const store = memoryStore()
    await expect(exclusive(store, 'k', async () => { throw new Error('full') })).rejects.toThrow('full')
    await update<number>(store, 'k', () => 1)
    expect(await store.get('k')).toBe(1)
  })
})

describe('backup: restore keeps the phone safe', () => {
  const setup = async () => {
    const store = memoryStore()
    const nora = await new ProfileRepo(store).create('Nora', '🐺')
    await new EngagementLog(store).add(nora.id, { type: 'profile_created' })
    return { store, nora, before: JSON.stringify(await exportBackup(store, new Date(0))) }
  }

  it('refuses a backup whose player list is damaged, and changes nothing', async () => {
    const { store, before } = await setup()
    const bad = JSON.stringify({ keypathBackup: 1, exportedAt: '', data: { [K.profiles]: { id: 'x' } } })
    await expect(restoreBackup(store, bad)).rejects.toMatchObject({ reason: 'damaged' })
    expect(JSON.stringify(await exportBackup(store, new Date(0)))).toBe(before)
  })

  it('puts back what was there when the phone refuses a write part way, rather than leaving it empty', async () => {
    const { store, nora, before } = await setup()
    const other = memoryStore()
    const vio = await new ProfileRepo(other).create('Vio', '🦊')
    await new EngagementLog(other).add(vio.id, { type: 'profile_created' })
    const backup = JSON.stringify(await exportBackup(other))
    let writes = 0
    const flaky = { ...store, set: async (k: string, v: unknown) => { if (++writes === 2) throw new Error('QuotaExceededError'); return store.set(k, v) } }
    await expect(restoreBackup(flaky, backup)).rejects.toMatchObject({ reason: 'write-failed' })
    expect(JSON.stringify(await exportBackup(store, new Date(0)))).toBe(before)
    expect((await new ProfileRepo(store).list()).map((p) => p.id)).toEqual([nora.id])
  })

  it('still replaces: what the backup doesn’t hold is gone after a restore that works', async () => {
    const { store, nora } = await setup()
    const backup = JSON.stringify({ keypathBackup: 1, exportedAt: '', data: { [K.profiles]: [] } })
    expect(await restoreBackup(store, backup)).toBe(1)
    expect(await store.get(K.log(nora.id))).toBeUndefined()
    expect(await new ProfileRepo(store).list()).toEqual([])
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

  it('says a backup from a newer KeyPath is newer, not "not a backup", and changes nothing', async () => {
    const store = memoryStore()
    await new ProfileRepo(store).create('A', '🦊')
    const newer = JSON.stringify({ keypathBackup: 2, exportedAt: new Date().toISOString(), data: { [K.profiles]: [] } })
    await expect(restoreBackup(store, newer)).rejects.toMatchObject({ reason: 'newer' })
    await expect(restoreBackup(store, '{"hello":1}')).rejects.toMatchObject({ reason: 'not-keypath' })
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
    expect(parseRoute(hrefOf({ name: 'challenge', game: 'echo' }))).toEqual({ name: 'challenge', game: 'echo' })
    expect(parseRoute('#/challenge/nope')).toEqual({ name: 'door', door: 'challenges' })
    expect(parseRoute(hrefOf({ name: 'progress' }))).toEqual({ name: 'progress' })
    expect(parseRoute(hrefOf({ name: 'studio', songId: 'starter:ode' }))).toEqual({ name: 'studio', songId: 'starter:ode' })
    expect(parseRoute(hrefOf({ name: 'journeyStep', step: 'chord' }))).toEqual({ name: 'journeyStep', step: 'chord' })
  })
})

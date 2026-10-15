import { describe, expect, it } from 'vitest'
import { Repo, checkBackup, memoryStore } from './repo'

const P = 'll:v1:'

describe('restoring a backup', () => {
  it('replaces the journey here instead of merging two into one', async () => {
    const repo = new Repo(memoryStore({ [`${P}theme:here`]: { id: 'here' }, [`${P}week:2026-W42`]: { weekKey: '2026-W42', here: true } }))
    const n = await repo.importAll({ app: 'the-long-listen', version: 1, records: { [`${P}theme:there`]: { id: 'there' }, [`${P}week:2026-W42`]: { weekKey: '2026-W42' } } })
    expect(n).toBe(2)
    expect((await repo.themes.all()).map((t) => t.id)).toEqual(['there'])
    expect(await repo.weeks.get('2026-W42')).toEqual({ weekKey: '2026-W42' })
  })

  it('has every Notion page checked again, rewrites the taste page, and keeps this notebook when the backup has none', async () => {
    const repo = new Repo(memoryStore({ [`${P}mark:notion:setup`]: { id: 'notion:setup', at: 'x', value: { journal: 'db' } } }))
    await repo.importAll({ app: 'the-long-listen', version: 1, records: {
      [`${P}notion:programme:p1`]: { key: 'programme:p1', pageId: 'pg', hash: 'h', bodyHash: 'b', syncedAt: 'x' },
      [`${P}notion:taste`]: { key: 'taste', pageId: 'tp', hash: 't', syncedAt: 'x' },
    } })
    expect(await repo.notion.get('programme:p1')).toMatchObject({ pageId: 'pg', hash: '', bodyHash: 'b' })
    expect(await repo.notion.get('taste')).toBeUndefined()
    expect((await repo.marks.get('notion:setup'))?.value).toEqual({ journal: 'db' })
  })

  it('changes nothing for a file that is not a backup, one from a newer app, or an empty one', async () => {
    const repo = new Repo(memoryStore({ [`${P}theme:here`]: { id: 'here' } }))
    await expect(repo.importAll({ app: 'other', records: {} })).rejects.toThrow()
    await expect(repo.importAll({ app: 'the-long-listen', version: 2, records: { [`${P}theme:x`]: { id: 'x' } } })).rejects.toThrow(/newer version/)
    await expect(repo.importAll({ app: 'the-long-listen', version: 1, records: { 'other:key': 1 } })).rejects.toThrow(/nothing to restore/)
    expect((await repo.themes.all()).map((t) => t.id)).toEqual(['here'])
  })

  it('says why a file is refused before anything is asked, and passes a backup it can restore', () => {
    expect(checkBackup(null)).toMatch(/isn’t a backup from this app/)
    expect(checkBackup({ app: 'other', version: 1, records: {} })).toMatch(/isn’t a backup from this app/)
    expect(checkBackup({ app: 'the-long-listen', version: 2, records: {} })).toMatch(/newer version/)
    expect(checkBackup({ app: 'the-long-listen', version: 1, records: [] })).toMatch(/can’t be read/)
    expect(checkBackup({ app: 'the-long-listen', version: 1, records: { 'other:key': {}, [`${P}theme:x`]: 'not a record' } })).toMatch(/nothing to restore/)
    expect(checkBackup({ app: 'the-long-listen', version: 1, records: { [`${P}theme:x`]: { id: 'x' } } })).toBeNull()
  })

  it('is all or nothing: a record that can’t be stored leaves the journey here as it was', async () => {
    const repo = new Repo(memoryStore({ [`${P}theme:here`]: { id: 'here' } }))
    // A function can't be cloned into the store, as IndexedDB would refuse it.
    await expect(repo.importAll({ app: 'the-long-listen', version: 1, records: { [`${P}theme:there`]: { id: 'there', bad: () => 1 } } })).rejects.toThrow()
    expect((await repo.themes.all()).map((t) => t.id)).toEqual(['here'])
  })
})

describe('the store', () => {
  it('replaces in one change: deletes and writes land together, or not at all', async () => {
    const store = memoryStore({ a: 1, b: 2 })
    await store.replace(['a'], [['c', 3], ['b', 4]])
    expect(Object.fromEntries(await store.entries())).toEqual({ b: 4, c: 3 })
    await expect(store.replace(['b', 'c'], [['d', () => 0]])).rejects.toThrow()
    expect(Object.fromEntries(await store.entries())).toEqual({ b: 4, c: 3 })
  })
})

describe('a fresh start', () => {
  it('clears the journey and never lets go of the settings and the notebook’s place', async () => {
    const repo = new Repo(memoryStore({
      [`${P}theme:t`]: { id: 't' },
      [`${P}singleton:preferences`]: { nextRequest: 'more Sibelius' },
      [`${P}mark:notion:setup`]: { id: 'notion:setup', at: 'x', value: { journal: 'db' } },
    }))
    await repo.freshStart()
    expect(await repo.themes.all()).toEqual([])
    expect((await repo.preferences()).nextRequest).toBe('')
    expect(await repo.marks.get('notion:setup')).toBeTruthy()
  })
})

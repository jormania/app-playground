import { describe, it, expect } from 'vitest'
import { syncToNotion, type NotionCall } from '../notion/mirror'
import { Repo, memoryStore } from '../store/repo'
import type { Concert } from '../domain/types'

const concert = (id: string, note: string): Concert => ({
  id, venue: 'Ateneul Român', date: '2026-10-09', soloists: [], works: [{ workId: 'w', composer: 'Jean Sibelius', title: 'Tapiola' }], note, source: 'typed', createdAt: '2026-10-09T20:00:00Z',
})

/** A fake Notion where one page has been deleted by the listener: editing it fails as Notion does. */
function notionWithDeleted() {
  const archived = new Set<string>()
  const calls: { path: string; method: string; body?: any }[] = []
  let n = 0
  const client: NotionCall = async <T,>(c: any): Promise<T> => {
    calls.push(c)
    const page = /^pages\/([^/]+)$/.exec(c.path)
    if (page && c.method === 'PATCH' && archived.has(page[1])) throw new Error('Can\'t edit block that is archived. You must unarchive the block before editing.')
    if (c.method === 'GET') return { results: [] } as T
    return { id: `id${++n}` } as T
  }
  return { client, calls, archived }
}

describe('audit: the Notion mirror', () => {
  it('a row the listener deleted in Notion does not stop every later row from ever syncing again', async () => {
    const repo = new Repo(memoryStore())
    const n = notionWithDeleted()
    await repo.concerts.putMany([concert('c1', 'Wonderful.'), concert('c2', 'Long.')])
    await syncToNotion(n.client, repo, 'page', '2026-W41')
    const first = (await repo.notion.get('concert:c1'))!.pageId
    // The listener deletes the first concert's row in Notion, then corrects both notes in the app.
    n.archived.add(first)
    await repo.concerts.putMany([concert('c1', 'Wonderful, again.'), concert('c2', 'Long, but worth it.')])
    await syncToNotion(n.client, repo, 'page', '2026-W41').catch(() => undefined)
    const second = (await repo.notion.get('concert:c2'))!.pageId
    expect(n.calls.some((c) => c.path === `pages/${second}` && c.method === 'PATCH')).toBe(true)
  })
})

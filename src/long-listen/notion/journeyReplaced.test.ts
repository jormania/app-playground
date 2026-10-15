import { describe, it, expect } from 'vitest'
import { Repo, memoryStore } from '../store/repo'
import { archiveNotebook, syncToNotion, type NotionCall, type Call } from './mirror'
import type { Concert } from '../domain/types'

const concert = (id: string, date: string) => ({ id, venue: 'Ateneu', date, soloists: [], works: [{ workId: 'w', composer: 'Claude Debussy', title: 'La mer' }], source: 'typed', createdAt: '2026-10-01T00:00:00Z' }) as unknown as Concert

function fakeNotion() {
  const calls: Call[] = []
  let n = 0
  const call: NotionCall = async <T,>(c: Call) => {
    calls.push(c)
    if (c.method === 'GET' || (c.method === 'POST' && c.path.includes('/query'))) return { results: [] } as T
    if (c.method === 'POST') return { id: `new${++n}` } as T
    return {} as T
  }
  return { calls, call }
}
const setup = { id: 'notion:setup', at: 'x', value: { journal: 'J', threads: 'T', recordings: 'R', composers: 'C', concerts: 'K', tastePage: 'TP', pageId: 'PAGE' } }
const rowsWritten = (calls: Call[]) => calls.filter((c) => c.method === 'POST' && c.path === 'pages' && (c.body as { parent?: { database_id?: string } }).parent?.database_id)

describe('a journey replaced, as Notion sees it (a stabilisation finding)', () => {
  it('a restore first takes the rows the backup doesn’t know to Notion’s trash, and keeps those it does', async () => {
    const repo = new Repo(memoryStore())
    await repo.marks.put(setup)
    await repo.concerts.putMany([concert('c1', '2026-10-01'), concert('c2', '2026-09-01')])
    await syncToNotion(fakeNotion().call, repo, 'PAGE', '2026-W42')
    const c1 = (await repo.notion.get('concert:c1'))!
    // A backup made when only c2 was kept: c1's row would be left behind.
    const before = await repo.exportAll()
    delete before.records['ll:v1:concert:c1']
    delete before.records['ll:v1:notion:concert:c1']
    const leaving = await repo.notionLeaving(before)
    expect(leaving.map((st) => st.key)).toEqual(['concert:c1'])
    const n = fakeNotion()
    await archiveNotebook(n.call, repo, leaving)
    expect(n.calls.map((c) => [c.method, c.path, (c.body as { archived?: boolean })?.archived])).toEqual([['PATCH', `pages/${c1.pageId}`, true]])
  })

  it('another Notion page is written afresh, not left empty while edits go to the old one', async () => {
    const repo = new Repo(memoryStore())
    await repo.marks.put(setup)
    await repo.concerts.put(concert('c1', '2026-10-01'))
    await syncToNotion(fakeNotion().call, repo, 'PAGE', '2026-W42')
    const n = fakeNotion()
    await syncToNotion(n.call, repo, 'PAGE2', '2026-W42')
    expect(rowsWritten(n.calls).length).toBeGreaterThan(0)
  })
})

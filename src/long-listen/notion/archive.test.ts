import { describe, expect, it } from 'vitest'
import { archiveNotebook, type NotionCall } from './mirror'
import { Repo, memoryStore } from '../store/repo'

const P = 'll:v1:'

describe('moving the notebook to the trash before a fresh start', () => {
  it('stops with a message the screen can show, and has the pages it trashed written afresh', async () => {
    const repo = new Repo(memoryStore({
      [`${P}notion:programme:p1`]: { key: 'programme:p1', pageId: 'ok', hash: 'h1', syncedAt: 'x' },
      [`${P}notion:thread:t1`]: { key: 'thread:t1', pageId: 'busy', hash: 'h2', syncedAt: 'x' },
    }))
    const call: NotionCall = async <T,>(c: { path: string }): Promise<T> => {
      if (c.path === 'pages/busy') throw new Error('Rate limited')
      return {} as T
    }
    await expect(archiveNotebook(call, repo)).rejects.toThrow('Notion didn’t take some pages to its trash, so nothing was cleared. Try again in a minute.')
    // The journey stays, so the page now in the trash must come back on the next sync; the one never moved is as it was.
    expect((await repo.notion.get('programme:p1'))?.hash).toBe('')
    expect((await repo.notion.get('thread:t1'))?.hash).toBe('h2')
  })

  it('counts a page already gone as done', async () => {
    const repo = new Repo(memoryStore({ [`${P}notion:programme:p1`]: { key: 'programme:p1', pageId: 'gone', hash: 'h', syncedAt: 'x' } }))
    const call: NotionCall = async () => { throw new Error('Could not find page with ID: gone') }
    await expect(archiveNotebook(call, repo)).resolves.toBe(0)
  })
})

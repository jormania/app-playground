import { describe, it, expect } from 'vitest'
import { syncToNotion, programmeBlocks, richText, journalProps } from './mirror'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import type { Programme } from '../domain/types'

const programme: Programme = {
  id: 'prog1', weekKey: '2026-W41', optionId: 'o', themeId: 'th1', explorationId: 'ex1', stage: 1,
  title: 'The orchestra becomes colour', dek: 'A standfirst.', introduction: 'One.\n\nTwo.', whyNow: 'Now.', historicalPlace: 'Then.', howTheyRelate: 'Together.',
  sections: [{ id: 's', role: 'start', heading: 'Start here', items: [{
    id: 'i1', workId: 'w1', recordingId: 'r1', why: 'Because.', whyThisRecording: 'Clarity.', listenFor: ['the dawn', 'the wind'],
    proposed: { composer: 'Claude Debussy', work: 'La mer', conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', soloists: [] },
  }] }],
  comparisonIds: [], createdAt: '2026-10-08T09:00:00Z', promptVersion: 'programme@x', model: 'm',
}

function fakeNotion() {
  const calls: { path: string; method: string; body?: any }[] = []
  let n = 0
  const client: CuratorClient = {
    async call<T>(op: string, payload: any): Promise<T> {
      expect(op).toBe('notion')
      calls.push(payload)
      if (payload.method === 'GET') return { results: [] } as T
      return { id: `id${++n}` } as T
    },
  }
  return { client, calls }
}

async function seeded() {
  const repo = new Repo(memoryStore())
  await repo.programmes.put(programme)
  await repo.themes.put({ id: 'th1', title: 'French orchestral colour', summary: '', firstIntroduced: '2026-W41', explorationIds: ['ex1'], openQuestions: ['Where next?'], adjacentTopics: [], nextDirections: ['Dutilleux'], updatedAt: 'x' })
  await repo.explorations.put({ id: 'ex1', themeId: 'th1', weekKey: '2026-W41', stage: 1, angle: 'a', programmeId: 'prog1' })
  await repo.recordings.put({ id: 'r1', workId: 'w1', soloistIds: [], character: [], verification: 'verified', spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['t1'], trackUris: [], confidence: 'strong', matchedAt: 'x' } })
  await repo.events.put({ id: 'e', at: '2026-10-09', kind: 'heard', recordingId: 'r1', workId: 'w1', source: 'manual' })
  await repo.feedback.put({ id: 'f', at: '2026-10-09', target: { type: 'recording', id: 'r1' }, reaction: 'loved', note: 'The colour!' })
  return repo
}

describe('the Notion notebook', () => {
  it('sets up its databases once, under the configured page', async () => {
    const repo = await seeded()
    const n = fakeNotion()
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const creates = n.calls.filter((c) => c.path === 'databases')
    expect(creates.map((c) => c.body.title[0].text.content)).toEqual(['The Long Listen — Journal', 'The Long Listen — Listening threads', 'The Long Listen — Works & recordings'])
    expect(creates.every((c) => c.body.parent.page_id === 'page123')).toBe(true)

    n.calls.length = 0
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    expect(n.calls.filter((c) => c.path === 'databases')).toHaveLength(0)
  })

  it('writes the programme as readable pages, and skips what has not changed', async () => {
    const repo = await seeded()
    const n = fakeNotion()
    const first = await syncToNotion(n.client, repo, 'page123', '2026-W41')
    expect(first.written).toBe(4) // journal page, thread, recording, taste page
    const rec = n.calls.find((c) => c.path === 'pages' && c.body.properties?.Performers)
    expect(rec?.body.properties).toMatchObject({
      Listening: { select: { name: 'Heard' } },
      Reaction: { select: { name: 'Loved it' } },
      Spotify: { url: 'https://open.spotify.com/track/t1' },
    })

    n.calls.length = 0
    expect((await syncToNotion(n.client, repo, 'page123', '2026-W41')).written).toBe(0)
    expect(n.calls).toHaveLength(0)

    // A week later the journal page's status changes; only that is patched.
    expect((await syncToNotion(n.client, repo, 'page123', '2026-W42')).written).toBe(1)
    expect(n.calls.map((c) => `${c.method} ${c.path.split('/')[0]}`)).toEqual(['PATCH pages'])
  })

  it('shows no internal machinery — no ids, versions or confidences', async () => {
    const repo = await seeded()
    const n = fakeNotion()
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const written = JSON.stringify(n.calls.filter((c) => c.path !== 'databases'))
    expect(written).not.toMatch(/prog1|programme@x|"strong"|recordingId|rec:|work:/)
  })

  it('lays a programme out as a reader would want it', () => {
    const blocks = programmeBlocks(programme, [{ kind: 'read', title: 'Note', url: 'https://example.org', source: 'LA Phil', purpose: 'Background.' }]) as any[]
    const types = blocks.map((b) => b.type)
    expect(types.slice(0, 3)).toEqual(['quote', 'paragraph', 'paragraph'])
    expect(blocks.some((b) => b.type === 'heading_3' && b.heading_3.rich_text[0].text.content === 'Claude Debussy — La mer')).toBe(true)
    expect(blocks.filter((b) => b.type === 'bulleted_list_item').map((b) => b.bulleted_list_item.rich_text[0].text.content)).toContain('Listen for: the dawn')
    expect(blocks.at(-1).bulleted_list_item.rich_text[0].text.link.url).toBe('https://example.org')
  })

  it('splits long text to Notion’s limit', () => {
    expect(richText('x'.repeat(4000))).toHaveLength(3)
  })

  it('marks a set-aside programme as such', () => {
    expect(journalProps(programme, 'T', [], [], true, '2026-W41').Status).toEqual({ select: { name: 'Set aside' } })
  })
})

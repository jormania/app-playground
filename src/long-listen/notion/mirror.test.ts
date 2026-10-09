import { describe, it, expect } from 'vitest'
import { syncToNotion, programmeBlocks, richText, journalProps, checkNotebook, discover, type NotionCall } from './mirror'
import { Repo, memoryStore } from '../store/repo'
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

function fakeNotion(children: any[] = [], databases: Record<string, any> = {}) {
  const calls: { path: string; method: string; body?: any }[] = []
  let n = 0
  const client: NotionCall = async <T,>(payload: any): Promise<T> => {
    calls.push(payload)
    if (payload.method === 'GET' && payload.path.includes('/children')) return { results: children } as T
    if (payload.method === 'GET' && payload.path.startsWith('databases/')) return (databases[payload.path.split('/')[1]] ?? { properties: {} }) as T
    if (payload.method === 'GET') return { id: 'page' } as T
    return { id: `id${++n}` } as T
  }
  return { client, calls }
}

/** A fuller fake: keeps page bodies, honours `after`, archives blocks. */
function pageNotion() {
  const pages = new Map<string, any[]>()
  let n = 0
  const textOf = (b: any) => (b[b.type]?.rich_text ?? []).map((t: any) => t.text?.content ?? '').join('') || undefined
  const client: NotionCall = async <T,>(c: any): Promise<T> => {
    const m = /^blocks\/([^/?]+)\/children/.exec(c.path)
    if (m && c.method === 'GET') {
      const list = (pages.get(m[1]) ?? []).filter((b) => !b.archived)
      return { results: list.map((b) => ({ id: b.id, type: b.type, [b.type]: { rich_text: [{ plain_text: b.text ?? '' }] } })) } as T
    }
    if (m && c.method === 'PATCH') {
      const list = pages.get(m[1]) ?? []
      const made = c.body.children.map((b: any) => ({ id: `blk${++n}`, type: b.type, text: textOf(b) }))
      const at = c.body.after ? list.findIndex((b) => b.id === c.body.after) : -1
      if (c.body.after && at < 0) throw new Error('no such block')
      list.splice(at >= 0 ? at + 1 : list.length, 0, ...made)
      pages.set(m[1], list)
      return { results: made.map((b: any) => ({ id: b.id })) } as T
    }
    const one = /^blocks\/([^/?]+)$/.exec(c.path)
    if (one && c.body?.archived) {
      for (const list of pages.values()) for (const b of list) if (b.id === one[1]) b.archived = true
      return {} as T
    }
    if (c.method === 'GET') return { results: [] } as T
    const id = `id${++n}`
    if (c.path === 'pages') pages.set(id, [])
    return { id } as T
  }
  return { client, pages }
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
    expect(creates.map((c) => c.body.title[0].text.content)).toEqual(['Journal', 'Listening threads', 'Works & recordings', 'Composers', 'Concerts'])
    expect(creates.every((c) => c.body.parent.page_id === 'page123')).toBe(true)

    n.calls.length = 0
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    expect(n.calls.filter((c) => c.path === 'databases')).toHaveLength(0)
  })

  it('writes the programme as readable pages, and skips what has not changed', async () => {
    const repo = await seeded()
    const n = fakeNotion()
    const first = await syncToNotion(n.client, repo, 'page123', '2026-W41')
    expect(first.written).toBe(5) // journal page, thread, recording, composer, taste page
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

  it('writes what played "On Spotify instead" to Works & recordings, marked as such', async () => {
    const repo = await seeded()
    await repo.comparisons.put({
      id: 'cmp:prog1:i1', workId: 'w1', framing: 'f', whyBoth: 'w', origin: 'on-request', standIn: true, createdAt: 'x',
      perspectives: [
        { recordingId: 'r1', proposed: programme.sections[0].items[0].proposed, character: 'c' },
        { recordingId: 'r2', proposed: { composer: 'Claude Debussy', work: 'La mer', conductor: 'Jean Martinon', orchestra: 'Orchestre National de l’ORTF', soloists: [] }, character: 'airy' },
      ],
    })
    const n = fakeNotion()
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const recs = n.calls.filter((c) => c.path === 'pages' && c.body.properties?.Performers).map((c) => c.body.properties)
    expect(recs).toHaveLength(2)
    expect(JSON.stringify(recs[1].Programme)).toContain('On Spotify instead')
    expect(JSON.stringify(recs[1].Performers)).toContain('Martinon')
  })

  it('adds further reading found after the page was written, right after the curator’s text, and keeps it current', async () => {
    const repo = await seeded()
    const n = pageNotion()
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const pageId = (await repo.notion.get('programme:prog1'))!.pageId
    const page = n.pages.get(pageId)!
    expect(page.some((b) => b.text === 'Further listening and reading')).toBe(false) // nothing found yet
    const textLen = page.length
    // The search finishes later.
    await repo.resources.put({ id: 'res1', programmeId: 'prog1', kind: 'read', title: 'Programme note', url: 'https://laphil.com/note', source: 'LA Phil', purpose: 'Background.', foundAt: 'x' })
    // Meanwhile the listener wrote their own note at the bottom of the page in Notion.
    page.push({ id: 'mine', type: 'paragraph', text: 'My own note' })
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const after = n.pages.get(pageId)!
    expect(after.slice(textLen, textLen + 3).map((b) => b.text ?? b.type)).toEqual(['divider', 'Further listening and reading', 'Read — Programme note (LA Phil). Background.'])
    expect(after[after.length - 1].id).toBe('mine') // the listener's note stays below, untouched
    // Unchanged: nothing written.
    expect((await syncToNotion(n.client, repo, 'page123', '2026-W41')).written).toBe(0)
    // Changed: exactly the app's resource blocks are replaced, in place.
    await repo.resources.put({ id: 'res2', programmeId: 'prog1', kind: 'watch', title: 'Talk', url: 'https://youtube.com/x', source: 'YouTube', purpose: 'A talk.', foundAt: 'y' })
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const third = n.pages.get(pageId)!.filter((b) => !b.archived)
    expect(third.filter((b) => b.text === 'Further listening and reading')).toHaveLength(1)
    expect(third.filter((b) => b.type === 'bulleted_list_item' && /LA Phil|YouTube/.test(b.text ?? ''))).toHaveLength(2)
    expect(third[third.length - 1].id).toBe('mine')
  })

  it('finds the further reading on a page written before the body was tracked, and replaces it in place', async () => {
    const repo = await seeded()
    const n = pageNotion()
    n.pages.set('legacy', [
      { id: 'b1', type: 'paragraph', text: 'Intro' },
      { id: 'b2', type: 'divider' },
      { id: 'b3', type: 'heading_2', text: 'Further listening and reading' },
      { id: 'b4', type: 'bulleted_list_item', text: 'Old link' },
      { id: 'b5', type: 'paragraph', text: 'My own note' },
    ])
    await repo.marks.put({ id: 'notion:setup', at: 'x', value: { journal: 'j', threads: 't', recordings: 'r', composers: 'c', tastePage: 'tp', pageId: 'page123' } })
    await repo.notion.put({ key: 'programme:prog1', pageId: 'legacy', hash: 'stale', syncedAt: 'x' })
    await repo.resources.put({ id: 'res1', programmeId: 'prog1', kind: 'read', title: 'Programme note', url: 'https://laphil.com/note', source: 'LA Phil', purpose: 'Background.', foundAt: 'x' })
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const live = n.pages.get('legacy')!.filter((b) => !b.archived).map((b) => b.text ?? b.type)
    expect(live).toEqual(['Intro', 'divider', 'Further listening and reading', 'Read — Programme note (LA Phil). Background.', 'My own note'])
  })

  it('finishes a journal page whose text failed to write, instead of making a second page', async () => {
    const repo = await seeded()
    const real = pageNotion()
    let failText = true
    let made = 0
    const flaky: NotionCall = async <T,>(c: any): Promise<T> => {
      if (c.method === 'POST' && c.path === 'pages' && c.body?.properties?.Visit) made++
      if (failText && c.method === 'PATCH' && /^blocks\/[^/]+\/children/.test(c.path)) { failText = false; throw new Error('429') }
      return real.client<T>(c)
    }
    await syncToNotion(flaky, repo, 'page123', '2026-W41').catch(() => undefined)
    await syncToNotion(flaky, repo, 'page123', '2026-W41')
    expect(made).toBe(1)
    const withText = [...real.pages.values()].filter((blocks) => blocks.some((b) => b.text === 'A standfirst.'))
    expect(withText).toHaveLength(1)
  })

  it('shows no internal machinery — no ids, versions or confidences', async () => {
    const repo = await seeded()
    const n = fakeNotion()
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    const written = JSON.stringify(n.calls.filter((c) => c.path !== 'databases'))
    expect(written).not.toMatch(/prog1|programme@x|"strong"|recordingId|rec:|work:/)
  })

  it('uses databases already on the page — a duplicated Starter Template works as it is', async () => {
    const repo = await seeded()
    const n = fakeNotion([
      { id: 'j1', type: 'child_database', child_database: { title: 'The Long Listen — Journal' } },
      { id: 'c1', type: 'child_database', child_database: { title: 'Composers' } },
      { id: 't1', type: 'child_page', child_page: { title: 'Musical taste' } },
    ])
    await syncToNotion(n.client, repo, 'page123', '2026-W41')
    expect(n.calls.filter((c) => c.path === 'databases').map((c) => c.body.title[0].text.content)).toEqual(['Listening threads', 'Works & recordings', 'Concerts'])
    expect(n.calls.some((c) => c.path === 'pages' && c.body.parent.page_id)).toBe(false) // taste page found, not made
    expect(n.calls.find((c) => c.path === 'pages' && c.body.properties?.Week)?.body.parent.database_id).toBe('j1')
    expect(n.calls.find((c) => c.path === 'pages' && c.body.properties?.Works)?.body.properties.Name.title[0].text.content).toBe('Claude Debussy')
  })

  it('checks a notebook without writing, and names missing columns', async () => {
    const n = fakeNotion(
      [{ id: 'j1', type: 'child_database', child_database: { title: 'Journal' } }],
      { j1: { properties: { Name: {}, Week: {}, Theme: {}, Status: {}, Heard: {}, Notes: {} } } },
    )
    const report = await checkNotebook(n.client, 'page123')
    expect(report).toMatchObject({ ok: false, found: ['journal'], missing: ['threads', 'recordings', 'composers', 'concerts'], missingColumns: ['Journal: Visit'] })
    expect(n.calls.every((c) => c.method === 'GET')).toBe(true)
    expect((await discover(n.client, 'page123')).databases).toEqual({ journal: 'j1' })
  })

  it('says plainly when the page is not shared with the integration', async () => {
    const failing: NotionCall = async () => { throw new Error('Could not find page') }
    const report = await checkNotebook(failing, 'page123')
    expect(report.ok).toBe(false)
    expect(report.message).toMatch(/Connections/)
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

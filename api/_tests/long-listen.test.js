// The Long Listen's curator endpoint. It holds ANTHROPIC_API_KEY and a Notion
// token, so the gate matters as much as the jobs: a missing or wrong passphrase
// must never reach Claude or Notion, and an error must never carry anything
// from upstream but a short, safe message.
//
// The Claude client is injected (deps.client), so these run the real
// validation and retry logic against canned model answers.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler, { passphraseMatches } from '../long-listen.js'
import { curatorBody, resourcesBody, CURATOR_BETAS } from '../_lib/longListen/curator.js'
import { PROMPTS } from '../_lib/longListen/prompts.js'

function makeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  return res
}

const KEY = 'a quiet passphrase'

function call(body, { key = KEY, deps } = {}) {
  const res = makeRes()
  const headers = key === null ? {} : { 'x-long-listen-key': key }
  const req = { method: 'POST', headers, socket: { remoteAddress: `t-${Math.random()}` }, body }
  return handler(req, res, deps).then(() => res)
}

/** A stand-in for the SDK client: answers each request with the next canned message. */
function fakeClient(answers) {
  const sent = []
  const queue = [...answers]
  return {
    sent,
    beta: {
      messages: {
        stream: (body) => {
          sent.push(body)
          const next = queue.shift()
          return { finalMessage: async () => (typeof next === 'function' ? next(body) : next) }
        },
      },
    },
  }
}

const json = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(obj) }] })

let env
beforeEach(() => {
  env = { ...process.env }
  process.env.LONG_LISTEN_ACCESS_KEY = KEY
  process.env.ANTHROPIC_API_KEY = 'sk-test'
  delete process.env.LONG_LISTEN_NOTION_TOKEN
  delete process.env.LONG_LISTEN_NOTION_PAGE_ID
})
afterEach(() => { process.env = env })

describe('the gate', () => {
  it('asks for a key when there is neither one of yours nor a server passphrase', async () => {
    delete process.env.LONG_LISTEN_ACCESS_KEY
    const status = await call({ op: 'status' })
    expect(status.statusCode).toBe(200)
    expect(status.body).toMatchObject({ serverKey: false, unlocked: false, curator: false })
    const res = await call({ op: 'themes', payload: {} })
    expect(res.statusCode).toBe(501)
    expect(res.body.message).toMatch(/Anthropic key in Settings/)
  })

  it('runs on your own key without a passphrase, and never on a malformed one', async () => {
    delete process.env.LONG_LISTEN_ACCESS_KEY
    const client = fakeClient([json(threeOptions())])
    const own = (key) => {
      const res = makeRes()
      return handler({ method: 'POST', headers: { 'x-anthropic-key': key }, socket: { remoteAddress: `o-${Math.random()}` }, body: { op: 'themes', payload: { context: {} } } }, res, { client }).then(() => res)
    }
    expect((await own('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).statusCode).toBe(200)
    const bad = await own('my-password')
    expect(bad.statusCode).toBe(401)
    expect(bad.body.code).toBe('bad-key')
    expect(client.sent).toHaveLength(1)
  })

  it('tests a key with one tiny call, and says plainly when Anthropic refuses it', async () => {
    const ok = { messages: { create: async (body) => { expect(body.max_tokens).toBeLessThanOrEqual(16); return { model: body.model } } } }
    const res = await call({ op: 'ping' }, { deps: { client: ok } })
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const refusing = { messages: { create: async () => { throw new Anthropic.AuthenticationError(401, { error: { message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers()) } } }
    const bad = await call({ op: 'ping' }, { deps: { client: refusing } })
    expect(bad.statusCode).toBe(401)
    expect(bad.body).toEqual({ code: 'bad-key', message: 'Anthropic didn’t accept that key.' })
  })

  it('refuses a wrong or missing passphrase before doing anything', async () => {
    const client = fakeClient([])
    expect((await call({ op: 'themes', payload: {} }, { key: 'nope', deps: { client } })).statusCode).toBe(401)
    expect((await call({ op: 'themes', payload: {} }, { key: null, deps: { client } })).statusCode).toBe(401)
    expect(client.sent).toHaveLength(0)
  })

  it('compares in constant time and only equal strings pass', () => {
    expect(passphraseMatches(KEY, KEY)).toBe(true)
    expect(passphraseMatches(`${KEY} `, KEY)).toBe(false)
    expect(passphraseMatches(undefined, KEY)).toBe(false)
    expect(passphraseMatches(KEY, '')).toBe(false)
  })

  it('reports what is configured, without secrets', async () => {
    const res = await call({ op: 'status' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ serverKey: true, unlocked: true, curator: true, notion: false })
    expect((await call({ op: 'status' }, { key: 'wrong' })).body).toMatchObject({ serverKey: true, unlocked: false, curator: false })
    expect(JSON.stringify(res.body)).not.toContain('sk-test')
    expect(res.body.prompts.programme).toBe(PROMPTS.programme.version)
  })

  it('rejects GET and unknown jobs', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, socket: {} }, res)
    expect(res.statusCode).toBe(405)
    expect((await call({ op: 'drop-tables' })).statusCode).toBe(400)
  })
})

const threeOptions = (over = {}) => ({
  options: [
    { mood: 'immersive', title: 'Into the night', pitch: 'Nocturnal music from Ravel onward.', character: ['atmospheric'], why: 'You liked colour.', angle: 'Night as colour.', returningThemeId: '', continuityNote: '' },
    { mood: 'curious', title: 'How Debussy changed the orchestra', pitch: 'Debussy and after.', character: ['colour'], why: 'A question you asked.', angle: 'Orchestration.', returningThemeId: '', continuityNote: '' },
    { mood: 'adventurous', title: 'The orchestra after the war', pitch: 'Boulez, Ligeti, Lutosławski.', character: ['post-1945'], why: 'New ground.', angle: 'Texture.', returningThemeId: '', continuityNote: '' },
    ...(over.extra ?? []),
  ].map((o, i) => ({ ...o, ...(over[i] ?? {}) })),
})

describe('themes', () => {
  it('returns three distinct directions and keeps a real returning thread', async () => {
    const client = fakeClient([json(threeOptions({ 1: { returningThemeId: 'theme-french', continuityNote: 'We first explored French colour six weeks ago.' } }))])
    const res = await call({ op: 'themes', payload: { today: '2026-10-08', week: { key: '2026-W41' }, context: { threads: [{ themeId: 'theme-french' }] } } }, { deps: { client } })
    expect(res.statusCode).toBe(200)
    expect(res.body.options.map((o) => o.mood)).toEqual(['immersive', 'curious', 'adventurous'])
    expect(res.body.options[1].returning).toEqual({ themeId: 'theme-french', note: 'We first explored French colour six weeks ago.' })
    expect(client.sent).toHaveLength(1)
  })

  it('asks again when two options share a mood, carrying the problem as a correction', async () => {
    const client = fakeClient([json(threeOptions({ 2: { mood: 'immersive' } })), json(threeOptions())])
    const res = await call({ op: 'themes', payload: { today: '2026-10-08', week: { key: '2026-W41' }, context: { threads: [] } } }, { deps: { client } })
    expect(res.statusCode).toBe(200)
    expect(client.sent).toHaveLength(2)
    expect(client.sent[1].messages[0].content).toContain('one immersive, one curious and one adventurous')
    expect(client.sent[1].messages).toHaveLength(1) // a fresh request, never edited history
  })

  it('drops a returning id the client never sent rather than trusting it', async () => {
    const client = fakeClient([json(threeOptions({ 0: { returningThemeId: 'made-up', continuityNote: 'x' } })), json(threeOptions({ 0: { returningThemeId: 'made-up', continuityNote: 'x' } }))])
    const res = await call({ op: 'themes', payload: { context: { threads: [] } } }, { deps: { client } })
    expect(res.statusCode).toBe(200)
    expect(res.body.options[0].returning).toBeUndefined()
  })

  it('fails cleanly when the curator cannot produce three', async () => {
    const two = { options: threeOptions().options.slice(0, 2) }
    const client = fakeClient([json(two), json(two)])
    const res = await call({ op: 'themes', payload: { context: {} } }, { deps: { client } })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ code: 'invalid', message: 'The curator could not settle on three directions.' })
  })
})

const item = (composer, workTitle, conductor = 'Pierre Boulez', orchestra = 'Cleveland Orchestra', extra = {}) => ({
  composer, workTitle, catalogue: '', composed: '', form: '', workContext: '', conductor, orchestra, ensemble: '', soloists: [], year: '',
  character: ['transparent'], why: 'Because.', whyThisRecording: 'Clarity.', listenFor: ['the opening'], revisitReason: '', ...extra,
})
const programme = (items, over = {}) => ({
  title: 'The orchestra becomes colour', dek: 'A standfirst.', introduction: 'Para one.\n\nPara two.', whyNow: 'w', historicalPlace: 'h', howTheyRelate: 'r', continuityNote: '',
  sections: [{ role: 'start', heading: 'Start here', note: '', items: items.slice(0, 1) }, { role: 'then', heading: 'Then', note: '', items: items.slice(1) }],
  comparisons: [], ...over,
})

describe('programme', () => {
  const fresh = [item('Claude Debussy', 'La mer'), item('Maurice Ravel', 'Daphnis et Chloé'), item('Lili Boulanger', "D'un matin de printemps", 'Yan Pascal Tortelier', 'BBC Philharmonic')]

  it('accepts a programme where every item is a recording', async () => {
    const client = fakeClient([json(programme(fresh))])
    const res = await call({ op: 'programme', payload: { option: { title: 'Colour' }, thread: null } }, { deps: { client } })
    expect(res.statusCode).toBe(200)
    expect(res.body.programme.sections.flatMap((s) => s.items)).toHaveLength(3)
    expect(res.body.programme.sections[0].items[0]).toMatchObject({ conductor: 'Pierre Boulez', catalogue: undefined })
  })

  it('refuses a work with no performers — a work is not a recording', async () => {
    const bare = [...fresh, item('Claude Debussy', 'Jeux', '', '')]
    const client = fakeClient([json(programme(bare)), json(programme(fresh))])
    const res = await call({ op: 'programme', payload: { option: { title: 'Colour' } } }, { deps: { client } })
    expect(client.sent).toHaveLength(2)
    expect(client.sent[1].messages[0].content).toContain('names no performers')
    expect(res.body.programme.sections.flatMap((s) => s.items).map((i) => i.workTitle)).not.toContain('Jeux')
  })

  describe('a returning theme expands, never restarts', () => {
    const thread = {
      title: 'French orchestral colour', stage: 2,
      covered: { works: [{ composer: 'Claude Debussy', title: 'La mer' }, { composer: 'Maurice Ravel', title: 'Daphnis et Chloé — Suite No. 2' }] },
    }
    const expanding = [item('Albert Roussel', 'Bacchus et Ariane'), item('Florent Schmitt', 'La tragédie de Salomé'), item('Henri Dutilleux', 'Métaboles')]

    it('asks again when the return repeats covered works, and the second answer stands', async () => {
      const repeating = programme([item('Claude Debussy', 'La mer in D-flat'), ...expanding], { continuityNote: 'Six weeks ago we heard La mer.' })
      const client = fakeClient([json(repeating), json(programme(expanding, { continuityNote: 'We return by a different door.' }))])
      const res = await call({ op: 'programme', payload: { option: { title: 'Colour, again' }, thread } }, { deps: { client } })
      expect(client.sent).toHaveLength(2)
      expect(client.sent[1].messages[0].content).toContain('already explored in this thread')
      expect(res.body.removedRepeats).toBe(0)
      expect(res.body.programme.sections.flatMap((s) => s.items).map((i) => i.composer)).toEqual(['Albert Roussel', 'Florent Schmitt', 'Henri Dutilleux'])
    })

    it('strips repeats that survive the retry rather than passing them through', async () => {
      const stubborn = programme([item('Claude Debussy', 'La mer'), ...expanding], { continuityNote: 'Again.' })
      const client = fakeClient([json(stubborn), json(stubborn)])
      const res = await call({ op: 'programme', payload: { option: { title: 'Colour' }, thread } }, { deps: { client } })
      expect(res.statusCode).toBe(200)
      expect(res.body.removedRepeats).toBe(1)
      expect(res.body.programme.sections.flatMap((s) => s.items).some((i) => i.workTitle === 'La mer')).toBe(false)
    })

    it('lets a deliberate revisit through when it says why', async () => {
      const revisit = programme([item('Claude Debussy', 'La mer', 'Désiré-Émile Inghelbrecht', 'Orchestre national de la RTF', { revisitReason: 'The same sea, heard through the conductor Debussy trusted.' }), ...expanding], { continuityNote: 'Back to the sea, by another boat.' })
      const client = fakeClient([json(revisit)])
      const res = await call({ op: 'programme', payload: { option: { title: 'Colour' }, thread } }, { deps: { client } })
      expect(client.sent).toHaveLength(1)
      expect(res.body.programme.sections[0].items[0].revisitReason).toMatch(/conductor Debussy trusted/)
    })

    it('insists on a continuity note for a return', async () => {
      const client = fakeClient([json(programme(expanding)), json(programme(expanding, { continuityNote: 'We first met this six weeks ago.' }))])
      await call({ op: 'programme', payload: { option: { title: 'Colour' }, thread } }, { deps: { client } })
      expect(client.sent[1].messages[0].content).toContain('write a continuityNote')
    })
  })

  it('keeps only comparisons of two genuinely different interpretations', async () => {
    const p = programme(fresh, {
      comparisons: [
        { composer: 'Claude Debussy', workTitle: 'La mer', catalogue: '', framing: 'f', whyBoth: 'w', perspectives: [
          { conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', ensemble: '', soloists: [], year: '', character: 'clear', listenFor: '' },
          { conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker', ensemble: '', soloists: [], year: '', character: 'lush', listenFor: '' },
        ] },
        { composer: 'Maurice Ravel', workTitle: 'Daphnis', catalogue: '', framing: 'f', whyBoth: 'w', perspectives: [
          { conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', ensemble: '', soloists: [], year: '', character: 'a', listenFor: '' },
          { conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', ensemble: '', soloists: [], year: '', character: 'b', listenFor: '' },
        ] },
      ],
    })
    const res = await call({ op: 'programme', payload: { option: { title: 'x' } } }, { deps: { client: fakeClient([json(p)]) } })
    expect(res.body.programme.comparisons).toHaveLength(1)
    expect(res.body.programme.comparisons[0].perspectives[1].conductor).toBe('Herbert von Karajan')
  })
})

describe('taste', () => {
  it('keeps only evidence the client actually sent, and only known replacements', async () => {
    const client = fakeClient([json({
      observations: [
        { facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to orchestral colour, less to repetition.', stance: 'drawn-to', confidence: 'tentative', evidence: ['fb1', 'fb-invented'], replaces: 'obs-unknown' },
        { facet: 'composer', subject: 'Glass', statement: 'Unconvinced by Glass.', stance: 'wary-of', confidence: 'tentative', evidence: [], replaces: '' },
      ],
      questions: ['What makes repetition feel alive?'],
    })])
    const res = await call({ op: 'taste', payload: { profile: { observations: [{ id: 'obs1' }] }, feedback: [{ id: 'fb1', note: 'I loved the colour but the middle was too repetitive.' }] } }, { deps: { client } })
    expect(res.statusCode).toBe(200)
    expect(res.body.observations).toHaveLength(1)
    expect(res.body.observations[0]).toMatchObject({ evidence: ['fb1'], replaces: undefined })
    expect(res.body.questions).toEqual(['What makes repetition feel alive?'])
  })
})

describe('resources', () => {
  it('keeps only URLs that came back from the web search in that response', async () => {
    const message = {
      stop_reason: 'end_turn',
      content: [
        { type: 'server_tool_use', name: 'web_search', input: { query: 'La mer programme note' } },
        { type: 'web_search_tool_result', content: [
          { type: 'web_search_result', url: 'https://www.laphil.com/musicdb/pieces/1/la-mer', title: 'La mer | LA Phil' },
          { type: 'web_search_result', url: 'https://www.bbc.co.uk/sounds/play/x', title: 'Building a Library' },
        ] },
        { type: 'text', text: 'Here you are:\n' + JSON.stringify({ resources: [
          { kind: 'read', title: 'La mer — programme note', url: 'https://www.laphil.com/musicdb/pieces/1/la-mer/', source: 'LA Phil', purpose: 'The background.', relatesTo: 'La mer' },
          { kind: 'listen', title: 'Building a Library', url: 'https://www.bbc.co.uk/sounds/play/x', source: 'BBC Radio 3', purpose: 'Compare recordings.', relatesTo: 'La mer' },
          { kind: 'watch', title: 'An invented lecture', url: 'https://www.example-conservatoire.edu/lecture', source: 'Somewhere', purpose: 'x', relatesTo: '' },
        ] }) },
      ],
    }
    const client = fakeClient([message])
    const fetchMock = vi.fn(async (url) => new Response('', { status: String(url).includes('bbc') ? 404 : 200 }))
    const res = await call({ op: 'resources', payload: { programme: { title: 'Colour' } } }, { deps: { client, fetch: fetchMock } })
    expect(res.statusCode).toBe(200)
    // The invented URL is dropped as unverified, the BBC one as dead (404).
    expect(res.body.resources.map((r) => r.url)).toEqual(['https://www.laphil.com/musicdb/pieces/1/la-mer'])
    expect(res.body.dropped).toBe(1)
    expect(client.sent[0].tools[0]).toMatchObject({ type: 'web_search_20260209', name: 'web_search' })
  })

  it('continues a paused search turn append-only', async () => {
    const paused = { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search', input: {} }] }
    const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"resources":[]}' }] }
    const client = fakeClient([paused, done])
    await call({ op: 'resources', payload: { programme: { title: 'x' } } }, { deps: { client, fetch: vi.fn() } })
    expect(client.sent).toHaveLength(2)
    expect(client.sent[1].messages).toHaveLength(2)
    expect(client.sent[1].messages[1]).toEqual({ role: 'assistant', content: paused.content })
  })
})

describe('errors stay safe', () => {
  it('turns an upstream failure into a short message with no detail', async () => {
    const client = { beta: { messages: { stream: () => ({ finalMessage: async () => { throw new Error('ECONNRESET at 10.0.0.1 with key sk-test') } }) } } }
    const res = await call({ op: 'themes', payload: { context: {} } }, { deps: { client } })
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toMatch(/sk-test|10\.0\.0\.1|ECONNRESET/)
  })

  it('reports a refusal as such', async () => {
    const res = await call({ op: 'explain', payload: { item: {} } }, { deps: { client: fakeClient([{ stop_reason: 'refusal', content: [] }]) } })
    expect(res.statusCode).toBe(422)
  })

  it('says the curator is not configured when there is no Anthropic key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await call({ op: 'themes', payload: {} })
    expect(res.statusCode).toBe(501)
  })
})

describe('notion pass-through', () => {
  beforeEach(() => {
    process.env.LONG_LISTEN_NOTION_TOKEN = 'secret_notion'
    process.env.LONG_LISTEN_NOTION_PAGE_ID = '0123456789abcdef0123456789abcdef'
  })

  it('forwards an allowed call with the server token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'db1' }), { status: 200 }))
    const res = await call({ op: 'notion', payload: { path: 'databases', method: 'POST', body: { parent: { page_id: '01234567-89ab-cdef-0123-456789abcdef' } } } }, { deps: { fetch: fetchMock } })
    expect(res.statusCode).toBe(200)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret_notion')
  })

  it('keeps the server’s Notion token behind the passphrase, whatever key you bring', async () => {
    const fetchMock = vi.fn()
    const res = makeRes()
    await handler({ method: 'POST', headers: { 'x-anthropic-key': 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz' }, socket: { remoteAddress: 'n1' }, body: { op: 'notion', payload: { path: 'pages', method: 'POST', body: {} } } }, res, { fetch: fetchMock })
    expect(res.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses calls outside the mirror’s fence', async () => {
    const fetchMock = vi.fn()
    const deps = { fetch: fetchMock }
    expect((await call({ op: 'notion', payload: { path: 'users', method: 'GET' } }, { deps })).statusCode).toBe(400)
    expect((await call({ op: 'notion', payload: { path: 'databases', method: 'POST', body: { parent: { page_id: 'ffffffffffffffffffffffffffffffff' } } } }, { deps })).statusCode).toBe(400)
    expect((await call({ op: 'notion', payload: { path: 'pages', method: 'POST', body: { parent: { page_id: 'ffffffffffffffffffffffffffffffff' } } } }, { deps })).statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the request shape', () => {
  it('uses Sonnet with adaptive thinking, a json_schema output and the server-side fallback', () => {
    const body = curatorBody('programme', 'hello')
    expect(body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high', format: { type: 'json_schema' } }, fallbacks: 'default' })
    expect(body.model).toMatch(/^claude-sonnet-/)
    expect(CURATOR_BETAS).toEqual(['server-side-fallback-2026-07-01'])
    expect(resourcesBody('x').output_config.format).toBeUndefined()
  })

  it('versions every prompt', () => {
    for (const p of Object.values(PROMPTS)) expect(p.version).toMatch(new RegExp(`^${p.id}@\\d{4}-\\d{2}-\\d{2}\\.\\d+$`))
  })
})

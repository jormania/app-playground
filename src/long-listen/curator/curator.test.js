// The curator, called from the browser with the listener's own key. These run
// the real validation and retry logic against canned model answers (an injected
// `send`), and check the wire call itself against a stubbed fetch.
import { describe, it, expect, vi } from 'vitest'
import { directCurator, anthropicSender, curatorBody, resourcesBody, pingBody, looksLikeAnthropicKey } from './curator.js'
import { PROMPTS } from './prompts.js'
import { CuratorUnavailable } from '../curation/api'

/** Answers each request with the next canned message, and records what was sent. */
function fakeSend(answers) {
  const sent = []
  const queue = [...answers]
  const send = async (body) => {
    sent.push(body)
    const next = queue.shift()
    if (next instanceof Error) throw next
    return typeof next === 'function' ? next(body) : next
  }
  return { send, sent, curator: directCurator(() => '', { send }) }
}

const json = (obj) => ({ stop_reason: 'end_turn', model: 'claude-sonnet', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(obj) }] })
const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz'

const threeOptions = (over = {}) => ({
  options: [
    { mood: 'immersive', title: 'Into the night', pitch: 'Nocturnal music from Ravel onward.', character: ['atmospheric'], why: 'You liked colour.', angle: 'Night as colour.', returningThemeId: '', continuityNote: '' },
    { mood: 'curious', title: 'How Debussy changed the orchestra', pitch: 'Debussy and after.', character: ['colour'], why: 'A question you asked.', angle: 'Orchestration.', returningThemeId: '', continuityNote: '' },
    { mood: 'adventurous', title: 'The orchestra after the war', pitch: 'Boulez, Ligeti, Lutosławski.', character: ['post-1945'], why: 'New ground.', angle: 'Texture.', returningThemeId: '', continuityNote: '' },
  ].map((o, i) => ({ ...o, ...(over[i] ?? {}) })),
})

describe('the key, and the call to Anthropic', () => {
  it('asks for a key before anything else, and refuses one that is not an Anthropic key', async () => {
    const fetchMock = vi.fn()
    await expect(directCurator(() => '', { fetchImpl: fetchMock }).call('themes', {})).rejects.toMatchObject({ code: 'locked' })
    await expect(directCurator(() => 'my-password', { fetchImpl: fetchMock }).call('themes', {})).rejects.toMatchObject({ code: 'bad-key' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(looksLikeAnthropicKey(KEY)).toBe(true)
  })

  it('calls Anthropic straight from the browser with the listener’s key, like every app here', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'ready' }] })))
    const r = await directCurator(() => ` ${KEY} `, { fetchImpl: fetchMock }).call('ping', {})
    expect(r).toEqual({ ok: true, model: 'claude-sonnet-5-5' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe(KEY)
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(JSON.parse(init.body).max_tokens).toBeLessThanOrEqual(16)
  })

  it('turns every failure into words a listener can read', async () => {
    const answer = (status) => anthropicSender(KEY, vi.fn(async () => new Response('{"error":{"message":"invalid x-api-key sk-ant-…"}}', { status })))({})
    await expect(answer(401)).rejects.toMatchObject({ code: 'bad-key', message: 'Anthropic didn’t accept that key. Check it in Settings.' })
    await expect(answer(429)).rejects.toMatchObject({ code: 'busy' })
    await expect(answer(529)).rejects.toMatchObject({ code: 'busy' })
    await expect(answer(500)).rejects.toMatchObject({ code: 'failed' })
    await expect(anthropicSender(KEY, vi.fn(async () => { throw new TypeError('Failed to fetch') }))({})).rejects.toMatchObject({ code: 'offline' })
    try { await answer(401) } catch (e) { expect(e.message).not.toMatch(/sk-ant|invalid x-api-key/) }
  })

  it('reports a refusal as such', async () => {
    const { curator } = fakeSend([{ stop_reason: 'refusal', content: [] }])
    await expect(curator.call('explain', { item: {} })).rejects.toMatchObject({ code: 'declined' })
  })
})

describe('themes', () => {
  it('returns three distinct directions and keeps a real returning thread', async () => {
    const { curator, sent } = fakeSend([json(threeOptions({ 1: { returningThemeId: 'theme-french', continuityNote: 'We first explored French colour six weeks ago.' } }))])
    const res = await curator.call('themes', { today: '2026-10-08', week: { key: '2026-W41' }, context: { threads: [{ themeId: 'theme-french' }] } })
    expect(res.options.map((o) => o.mood)).toEqual(['immersive', 'curious', 'adventurous'])
    expect(res.options[1].returning).toEqual({ themeId: 'theme-french', note: 'We first explored French colour six weeks ago.' })
    expect(sent).toHaveLength(1)
  })

  it('asks again when two options share a mood, carrying the problem as a correction', async () => {
    const { curator, sent } = fakeSend([json(threeOptions({ 2: { mood: 'immersive' } })), json(threeOptions())])
    await curator.call('themes', { context: { threads: [] } })
    expect(sent).toHaveLength(2)
    expect(sent[1].messages[0].content).toContain('one immersive, one curious and one adventurous')
    expect(sent[1].messages).toHaveLength(1) // a fresh request, never edited history
  })

  it('drops a returning id the app never sent rather than trusting it', async () => {
    const bad = json(threeOptions({ 0: { returningThemeId: 'made-up', continuityNote: 'x' } }))
    const res = await fakeSend([bad, bad]).curator.call('themes', { context: { threads: [] } })
    expect(res.options[0].returning).toBeUndefined()
  })

  it('fails cleanly when the curator cannot produce three', async () => {
    const two = json({ options: threeOptions().options.slice(0, 2) })
    await expect(fakeSend([two, two]).curator.call('themes', { context: {} })).rejects.toBeInstanceOf(CuratorUnavailable)
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
    const res = await fakeSend([json(programme(fresh))]).curator.call('programme', { option: { title: 'Colour' }, thread: null })
    expect(res.programme.sections.flatMap((s) => s.items)).toHaveLength(3)
    expect(res.programme.sections[0].items[0]).toMatchObject({ conductor: 'Pierre Boulez', catalogue: undefined })
  })

  it('refuses a work with no performers — a work is not a recording', async () => {
    const { curator, sent } = fakeSend([json(programme([...fresh, item('Claude Debussy', 'Jeux', '', '')])), json(programme(fresh))])
    const res = await curator.call('programme', { option: { title: 'Colour' } })
    expect(sent[1].messages[0].content).toContain('names no performers')
    expect(res.programme.sections.flatMap((s) => s.items).map((i) => i.workTitle)).not.toContain('Jeux')
  })

  describe('a returning theme expands, never restarts', () => {
    const thread = { title: 'French orchestral colour', stage: 2, covered: { works: [{ composer: 'Claude Debussy', title: 'La mer' }, { composer: 'Maurice Ravel', title: 'Daphnis et Chloé — Suite No. 2' }] } }
    const expanding = [item('Albert Roussel', 'Bacchus et Ariane'), item('Florent Schmitt', 'La tragédie de Salomé'), item('Henri Dutilleux', 'Métaboles')]

    it('asks again when the return repeats covered works, and the second answer stands', async () => {
      const { curator, sent } = fakeSend([json(programme([item('Claude Debussy', 'La mer in D-flat'), ...expanding], { continuityNote: 'Six weeks ago.' })), json(programme(expanding, { continuityNote: 'Another door.' }))])
      const res = await curator.call('programme', { option: { title: 'Colour, again' }, thread })
      expect(sent[1].messages[0].content).toContain('already explored in this thread')
      expect(res.removedRepeats).toBe(0)
      expect(res.programme.sections.flatMap((s) => s.items).map((i) => i.composer)).toEqual(['Albert Roussel', 'Florent Schmitt', 'Henri Dutilleux'])
    })

    it('strips repeats that survive the retry rather than passing them through', async () => {
      const stubborn = json(programme([item('Claude Debussy', 'La mer'), ...expanding], { continuityNote: 'Again.' }))
      const res = await fakeSend([stubborn, stubborn]).curator.call('programme', { option: { title: 'Colour' }, thread })
      expect(res.removedRepeats).toBe(1)
      expect(res.programme.sections.flatMap((s) => s.items).some((i) => i.workTitle === 'La mer')).toBe(false)
    })

    it('lets a deliberate revisit through when it says why', async () => {
      const revisit = programme([item('Claude Debussy', 'La mer', 'Désiré-Émile Inghelbrecht', 'Orchestre national de la RTF', { revisitReason: 'The conductor Debussy trusted.' }), ...expanding], { continuityNote: 'Back to the sea.' })
      const { curator, sent } = fakeSend([json(revisit)])
      const res = await curator.call('programme', { option: { title: 'Colour' }, thread })
      expect(sent).toHaveLength(1)
      expect(res.programme.sections[0].items[0].revisitReason).toMatch(/Debussy trusted/)
    })

    it('insists on a continuity note for a return', async () => {
      const { curator, sent } = fakeSend([json(programme(expanding)), json(programme(expanding, { continuityNote: 'We met this six weeks ago.' }))])
      await curator.call('programme', { option: { title: 'Colour' }, thread })
      expect(sent[1].messages[0].content).toContain('write a continuityNote')
    })
  })

  it('keeps only comparisons of two genuinely different interpretations', async () => {
    const p = (a, b) => [
      { conductor: a[0], orchestra: a[1], ensemble: '', soloists: [], year: '', character: 'x', listenFor: '' },
      { conductor: b[0], orchestra: b[1], ensemble: '', soloists: [], year: '', character: 'y', listenFor: '' },
    ]
    const res = await fakeSend([json(programme(fresh, {
      comparisons: [
        { composer: 'Claude Debussy', workTitle: 'La mer', catalogue: '', framing: 'f', whyBoth: 'w', perspectives: p(['Pierre Boulez', 'Cleveland Orchestra'], ['Herbert von Karajan', 'Berliner Philharmoniker']) },
        { composer: 'Maurice Ravel', workTitle: 'Daphnis', catalogue: '', framing: 'f', whyBoth: 'w', perspectives: p(['Pierre Boulez', 'Cleveland Orchestra'], ['Pierre Boulez', 'Cleveland Orchestra']) },
      ],
    }))]).curator.call('programme', { option: { title: 'x' } })
    expect(res.programme.comparisons).toHaveLength(1)
    expect(res.programme.comparisons[0].perspectives[1].conductor).toBe('Herbert von Karajan')
  })
})

describe('taste', () => {
  it('keeps only evidence the app actually sent, and only known replacements', async () => {
    const res = await fakeSend([json({
      observations: [
        { facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to orchestral colour, less to repetition.', stance: 'drawn-to', confidence: 'tentative', evidence: ['fb1', 'fb-invented'], replaces: 'obs-unknown' },
        { facet: 'composer', subject: 'Glass', statement: 'Unconvinced by Glass.', stance: 'wary-of', confidence: 'tentative', evidence: [], replaces: '' },
      ],
      questions: ['What makes repetition feel alive?'],
    })]).curator.call('taste', { profile: { observations: [{ id: 'obs1' }] }, feedback: [{ id: 'fb1', note: 'Loved the colour, middle too repetitive.' }] })
    expect(res.observations).toHaveLength(1)
    expect(res.observations[0]).toMatchObject({ evidence: ['fb1'], replaces: undefined })
    expect(res.questions).toEqual(['What makes repetition feel alive?'])
  })
})

describe('resources', () => {
  it('keeps only URLs that came back from the web search in that response', async () => {
    const message = {
      stop_reason: 'end_turn',
      content: [
        { type: 'server_tool_use', name: 'web_search', input: { query: 'La mer programme note' } },
        { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://www.laphil.com/musicdb/pieces/1/la-mer', title: 'La mer | LA Phil' }] },
        { type: 'text', text: 'Here:\n' + JSON.stringify({ resources: [
          { kind: 'read', title: 'La mer — programme note', url: 'https://www.laphil.com/musicdb/pieces/1/la-mer/', source: 'LA Phil', purpose: 'The background.', relatesTo: 'La mer' },
          { kind: 'watch', title: 'An invented lecture', url: 'https://www.example-conservatoire.edu/lecture', source: 'Somewhere', purpose: 'x', relatesTo: '' },
        ] }) },
      ],
    }
    const { curator, sent } = fakeSend([message])
    const res = await curator.call('resources', { programme: { title: 'Colour' } })
    expect(res.resources.map((r) => r.url)).toEqual(['https://www.laphil.com/musicdb/pieces/1/la-mer'])
    expect(res.dropped).toBe(1)
    expect(sent[0].tools[0]).toMatchObject({ type: 'web_search_20260209', name: 'web_search' })
  })

  it('continues a paused search turn append-only', async () => {
    const paused = { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search', input: {} }] }
    const { curator, sent } = fakeSend([paused, { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"resources":[]}' }] }])
    await curator.call('resources', { programme: { title: 'x' } })
    expect(sent[1].messages).toEqual([sent[0].messages[0], { role: 'assistant', content: paused.content }])
  })
})

describe('the request shape', () => {
  it('uses Sonnet with adaptive thinking and a json_schema output, and nothing a browser call would choke on', () => {
    const body = curatorBody('programme', 'hello')
    expect(body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'medium', format: { type: 'json_schema' } } })
    expect(body.model).toMatch(/^claude-sonnet-/)
    expect(body).not.toHaveProperty('fallbacks')
    expect(resourcesBody('x').output_config.format).toBeUndefined()
    expect(pingBody().max_tokens).toBe(16)
  })

  it('versions every prompt', () => {
    for (const p of Object.values(PROMPTS)) expect(p.version).toMatch(new RegExp(`^${p.id}@\\d{4}-\\d{2}-\\d{2}\\.\\d+$`))
  })
})

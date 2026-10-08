// Click Deck's HowLongToBeat search used to be its own function,
// api/clickdeck-hltb.js. It moved into api/steam-search.js as `mode=hltb` so
// The Long Listen could have the slot (Vercel Hobby caps a deployment at twelve).
// These pin that the move kept the behaviour: the two-step handshake, the
// comp_plus → comp_main fallback, the 400 on a missing term, and a failed
// scrape coming back as a 502 with a message rather than a throw.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import handler from '../steam-search.js'

function makeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.send = (text) => { res.body = text; return res }
  res.setHeader = () => res
  return res
}

function call(query) {
  const res = makeRes()
  return handler({ method: 'GET', query, headers: {}, socket: {} }, res).then(() => res)
}

afterEach(() => vi.unstubAllGlobals())

describe('steam-search mode=hltb', () => {
  it('runs the handshake and reduces hits to hours, falling back to comp_main', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url).includes('/api/bleed/init')) {
        return new Response(JSON.stringify({ token: 't', hpKey: 'hk', hpVal: 'hv' }))
      }
      const body = JSON.parse(init.body)
      expect(body.hk).toBe('hv')
      expect(init.headers['x-auth-token']).toBe('t')
      return new Response(JSON.stringify({ data: [
        { game_id: 1, game_name: 'Obra Dinn', comp_plus: 36000, comp_main: 30000 },
        { game_id: 2, game_name: 'Among Graves', comp_plus: 0, comp_main: 7200 },
        { game_id: 3, game_name: 'Nothing', comp_plus: 0, comp_main: 0 },
      ] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await call({ mode: 'hltb', term: 'obra dinn' })
    expect(res.statusCode).toBe(200)
    expect(res.body.items).toEqual([
      { id: 1, name: 'Obra Dinn', hours: 10 },
      { id: 2, name: 'Among Graves', hours: 2 },
    ])
  })

  it('wants a term', async () => {
    const res = await call({ mode: 'hltb' })
    expect(res.statusCode).toBe(400)
  })

  it('turns a broken scrape into a 502 with a message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const res = await call({ mode: 'hltb', term: 'x' })
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toMatch(/HowLongToBeat/)
  })

  it('keeps the old URL working through a rewrite', () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'))
    expect(vercel.rewrites).toContainEqual({ source: '/api/clickdeck-hltb', destination: '/api/steam-search?mode=hltb' })
  })
})

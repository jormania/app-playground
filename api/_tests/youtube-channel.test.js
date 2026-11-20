// Stillflow's channel reader: both sources, pagination, the odd videos a
// channel's uploads hold (private, live, deleted), and every failure coming
// back as a status with a readable message, never a throw.
import { describe, it, expect, vi, afterEach } from 'vitest'
import handler from '../youtube-channel.js'
import { isoDurationSeconds, mergeApiPage, parseChannelFeed, uploadsPlaylistId } from '../_lib/youtube.js'

const CH = 'UCFKE7WVJfvaHW5q283SxchA'

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.setHeader = (k, v) => { res.headers[k] = v; return res }
  return res
}
const call = async (query, headers = {}) => {
  const res = makeRes()
  await handler({ method: 'GET', query, headers, socket: { remoteAddress: `t-${Math.random()}` } }, res)
  return res
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('helpers', () => {
  it('reads ISO durations', () => {
    expect(isoDurationSeconds('PT22M30S')).toBe(1350)
    expect(isoDurationSeconds('PT1H2M')).toBe(3720)
    expect(isoDurationSeconds('P1DT1S')).toBe(86401)
    expect(isoDurationSeconds('PT45S')).toBe(45)
    expect(isoDurationSeconds('P0D')).toBe(0)
    expect(isoDurationSeconds('PT')).toBeNull()
    expect(isoDurationSeconds('22:30')).toBeNull()
    expect(isoDurationSeconds(undefined)).toBeNull()
  })

  it('derives the uploads playlist', () => {
    expect(uploadsPlaylistId(CH)).toBe('UUFKE7WVJfvaHW5q283SxchA')
  })

  it('merges a page, dropping private, deleted, live and vanished videos', () => {
    const page = { items: [
      { snippet: { title: 'Day 1 | MOVE' }, contentDetails: { videoId: 'aaaaaaaaaaa', videoPublishedAt: '2022-01-02T06:00:00Z' } },
      { snippet: { title: 'Private video' }, contentDetails: { videoId: 'bbbbbbbbbbb' } },
      { snippet: { title: 'Live now' }, contentDetails: { videoId: 'ccccccccccc' } },
      { snippet: { title: 'Gone since listing' }, contentDetails: { videoId: 'ddddddddddd' } },
    ] }
    const details = { items: [
      { id: 'aaaaaaaaaaa', snippet: { title: 'Day 1 | MOVE', description: 'x'.repeat(5000), liveBroadcastContent: 'none' }, contentDetails: { duration: 'PT21M4S' } },
      { id: 'ccccccccccc', snippet: { title: 'Live now', liveBroadcastContent: 'live' }, contentDetails: { duration: 'P0D' } },
    ] }
    const out = mergeApiPage(page, details)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ videoId: 'aaaaaaaaaaa', durationSeconds: 1264, publishedAt: '2022-01-02T06:00:00Z' })
    expect(out[0].description).toHaveLength(2000)
  })

  it('parses the Atom feed, entities and CDATA included', () => {
    const xml = `<feed><entry><yt:videoId>eeeeeeeeeee</yt:videoId><title>Hips &amp; Back &#8211; 20 Min</title>
      <published>2026-11-01T12:00:00+00:00</published><media:group><media:description><![CDATA[Find what feels good]]></media:description></media:group></entry>
      <entry><title>no id</title></entry></feed>`
    expect(parseChannelFeed(xml)).toEqual([{
      videoId: 'eeeeeeeeeee', title: 'Hips & Back – 20 Min', description: 'Find what feels good',
      publishedAt: '2026-11-01T12:00:00+00:00', durationSeconds: null,
    }])
  })
})

describe('handler', () => {
  it('rejects bad input before touching the network', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect((await call({})).statusCode).toBe(400)
    expect((await call({ channel: 'yogawithadriene' })).statusCode).toBe(400)
    expect((await call({ channel: CH, pageToken: '../../etc' })).statusCode).toBe(400)
    expect((await call({ channel: CH }, { origin: 'https://evil.example' })).statusCode).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })

  it('without a key, reads the RSS feed', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      expect(url).toBe(`https://www.youtube.com/feeds/videos.xml?channel_id=${CH}`)
      return new Response('<feed><entry><yt:videoId>fffffffffff</yt:videoId><title>New</title></entry></feed>')
    }))
    const res = await call({ channel: CH })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ source: 'rss', nextPageToken: null, videos: [{ videoId: 'fffffffffff', durationSeconds: null }] })
    expect(res.headers['Cache-Control']).toMatch(/s-maxage/)
  })

  it('with a key, pages through the uploads playlist and never sends the key back', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'SECRET')
    const urls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      urls.push(url)
      if (url.includes('/playlistItems')) {
        return Response.json({ items: [{ snippet: { title: 'A' }, contentDetails: { videoId: 'ggggggggggg' } }], nextPageToken: 'NEXT', pageInfo: { totalResults: 760 } })
      }
      return Response.json({ items: [{ id: 'ggggggggggg', snippet: { title: 'A', liveBroadcastContent: 'none' }, contentDetails: { duration: 'PT10M' } }] })
    }))
    const res = await call({ channel: CH, pageToken: 'PREV' })
    expect(res.body).toEqual({ source: 'api', total: 760, nextPageToken: 'NEXT', videos: [{ videoId: 'ggggggggggg', title: 'A', description: '', publishedAt: null, durationSeconds: 600 }] })
    expect(urls[0]).toContain('playlistId=UUFKE7WVJfvaHW5q283SxchA')
    expect(urls[0]).toContain('pageToken=PREV')
    expect(JSON.stringify(res.body)).not.toContain('SECRET')
  })

  it('turns quota, bad key and network failures into readable statuses', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'K')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 })))
    let res = await call({ channel: CH })
    expect(res.statusCode).toBe(429)
    expect(res.body.message).toMatch(/quota/)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { errors: [{ reason: 'keyInvalid' }] } }, { status: 400 })))
    res = await call({ channel: CH })
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toMatch(/keyInvalid/)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    res = await call({ channel: CH })
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toMatch(/ECONNRESET/)
  })
})

describe('which videos still play', () => {
  it('rejects malformed id lists', async () => {
    expect((await call({ ids: 'short' }, {})).statusCode).toBe(400)
    expect((await call({ ids: Array(51).fill('aaaaaaaaaaa').map((x, i) => x.slice(0, 9) + String(i).padStart(2, '0')).join(',') })).statusCode).toBe(400)
    expect((await call({ ids: '' })).statusCode).toBe(400)
  })

  it('needs the API key', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')
    const res = await call({ ids: 'aaaaaaaaaaa' })
    expect(res.statusCode).toBe(501)
  })

  it('returns only the ids YouTube still serves publicly', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [
      { id: 'aaaaaaaaaaa', status: { uploadStatus: 'processed', privacyStatus: 'public' } },
      { id: 'ccccccccccc', status: { uploadStatus: 'processed', privacyStatus: 'private' } },
    ] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await call({ ids: 'aaaaaaaaaaa,bbbbbbbbbbb,ccccccccccc' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ checked: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'], available: ['aaaaaaaaaaa'] })
    expect(String(fetchMock.mock.calls[0][0])).toContain('part=status')
  })
})

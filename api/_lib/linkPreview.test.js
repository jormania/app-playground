import { test, expect, describe } from 'vitest'
import { isPrivateHost, emptyPreview, decodeEntities, metaTags, parsePreview } from './linkPreview.js'

describe('isPrivateHost', () => {
  test('rejects loopback, private, and link-local hosts', () => {
    for (const host of ['localhost', 'myserver.local', '127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.1.1', '172.16.0.1', '172.31.255.255', '0.0.0.0', '::1', 'fc00::1', 'fe80::1']) {
      expect(isPrivateHost(host)).toBe(true)
    }
  })

  test('allows an ordinary public host', () => {
    for (const host of ['example.com', 'en.wikipedia.org', '172.15.0.1', '172.32.0.1', '8.8.8.8']) {
      expect(isPrivateHost(host)).toBe(false)
    }
  })
})

describe('emptyPreview', () => {
  test('carries the hostname and href with everything else null', () => {
    expect(emptyPreview(new URL('https://example.com/a/b'))).toEqual({
      title: null, description: null, image: null, siteName: 'example.com', url: 'https://example.com/a/b',
    })
  })
})

describe('decodeEntities', () => {
  test('decodes the handful of entities meta content actually uses', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;s Big &quot;Day&quot; &lt;3&gt;')).toBe('Tom & Jerry \'s Big "Day" <3>')
  })
})

describe('metaTags', () => {
  test('reads property/content and name/content pairs regardless of attribute order', () => {
    const html = `
      <meta property="og:title" content="A Title">
      <meta content="Reordered" name="twitter:title">
    `
    const tags = metaTags(html)
    expect(tags.get('og:title')).toBe('A Title')
    expect(tags.get('twitter:title')).toBe('Reordered')
  })

  test('the first occurrence of a key wins, matching how browsers read og tags', () => {
    const html = `<meta property="og:title" content="First"><meta property="og:title" content="Second">`
    expect(metaTags(html).get('og:title')).toBe('First')
  })
})

describe('parsePreview', () => {
  const url = new URL('https://example.com/article')

  test('prefers og tags, falling back to <title> when there is no og:title', () => {
    const html = `<html><head><title>Fallback Title</title></head></html>`
    expect(parsePreview(html, url).title).toBe('Fallback Title')
  })

  test('og:title wins over <title>', () => {
    const html = `<html><head><title>Page Title</title><meta property="og:title" content="OG Title"></head></html>`
    expect(parsePreview(html, url).title).toBe('OG Title')
  })

  test('resolves a relative og:image against the page URL', () => {
    const html = `<meta property="og:image" content="/images/cover.png">`
    expect(parsePreview(html, url).image).toBe('https://example.com/images/cover.png')
  })

  test('never throws on a malformed og:image — resolves what it can, or leaves it null', () => {
    const html = `<meta property="og:image" content="ht!tp://[not a url">`
    expect(() => parsePreview(html, url)).not.toThrow()
  })

  test('falls back to the plain meta description', () => {
    const html = `<meta name="description" content="A plain description.">`
    expect(parsePreview(html, url).description).toBe('A plain description.')
  })

  test('a page with no metadata at all still returns a well-formed shape', () => {
    expect(parsePreview('<html><body>Nothing here.</body></html>', url)).toEqual({
      title: null, description: null, image: null, siteName: 'example.com', url: 'https://example.com/article',
    })
  })

  test('decodes entities in the title', () => {
    const html = `<meta property="og:title" content="Rock &amp; Roll">`
    expect(parsePreview(html, url).title).toBe('Rock & Roll')
  })
})

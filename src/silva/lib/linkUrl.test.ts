import { describe, it, expect } from 'vitest'
import { cleanLinkUrl, comparableUrl, sameLink } from './linkUrl'

const URL = 'https://www.thisiscolossal.com/2026/08/minyoung-kim/'

describe('cleanLinkUrl', () => {
  it('takes off what a share picked up on the way', () => {
    expect(cleanLinkUrl(`${URL}?utm_source=newsletter&utm_medium=email`)).toBe(URL)
    expect(cleanLinkUrl(`${URL}?fbclid=abc123`)).toBe(URL)
    expect(cleanLinkUrl('https://x.dev/a?b=1&utm_campaign=spring&c=2')).toBe('https://x.dev/a?b=1&c=2')
  })

  it('keeps the parameters that say which page this is', () => {
    expect(cleanLinkUrl('https://youtu.be/x?t=90')).toBe('https://youtu.be/x?t=90')
    expect(cleanLinkUrl('https://x.dev/read?id=17&page=2')).toBe('https://x.dev/read?id=17&page=2')
  })

  it('keeps the fragment, which is part of where you were', () => {
    expect(cleanLinkUrl(`${URL}?utm_source=x#the-paintings`)).toBe(`${URL}#the-paintings`)
    expect(cleanLinkUrl('https://x.dev/long#part-4')).toBe('https://x.dev/long#part-4')
  })

  // The one rule that keeps this from quietly rewriting links: with nothing
  // to remove, the string that comes back is the string that went in — no
  // added trailing slash, no re-encoding, no lowercased host.
  it('returns an untouched URL byte for byte', () => {
    for (const url of [
      'https://x.dev',
      'https://X.DEV/A/B',
      'https://x.dev/a?q=a%20b,c',
      'https://x.dev/a?q=Ça+va',
      'https://x.dev/search?q=%E2%80%94',
    ]) {
      expect(cleanLinkUrl(url)).toBe(url)
    }
  })

  it('does not re-encode the parameters it keeps', () => {
    expect(cleanLinkUrl('https://x.dev/a?q=a%20b,c&utm_source=x')).toBe('https://x.dev/a?q=a%20b,c')
    expect(cleanLinkUrl('https://x.dev/a?q=Ça+va&fbclid=1')).toBe('https://x.dev/a?q=Ça+va')
  })

  it('leaves alone anything that is not an http(s) URL it can parse', () => {
    expect(cleanLinkUrl('  not a url  ')).toBe('not a url')
    expect(cleanLinkUrl('mailto:someone@example.com?utm_source=x')).toBe('mailto:someone@example.com?utm_source=x')
  })

  it('survives a malformed escape in a parameter name', () => {
    expect(cleanLinkUrl('https://x.dev/a?%E0%A4%A=1&utm_source=x')).toBe('https://x.dev/a?%E0%A4%A=1')
  })
})

describe('comparableUrl', () => {
  it('ignores what a share picks up on the way', () => {
    expect(sameLink(URL, `${URL}?utm_source=newsletter&utm_medium=email`)).toBe(true)
    expect(sameLink(URL, `${URL}?fbclid=abc123`)).toBe(true)
    expect(sameLink(URL, `${URL}#the-paintings`)).toBe(true)
  })

  it('ignores www, a trailing slash and parameter order', () => {
    expect(sameLink(URL, 'https://thisiscolossal.com/2026/08/minyoung-kim')).toBe(true)
    expect(sameLink('https://x.dev/a?b=1&c=2', 'https://x.dev/a?c=2&b=1')).toBe(true)
  })

  it('keeps parameters that say which page this is', () => {
    expect(sameLink('https://x.dev/read?id=1', 'https://x.dev/read?id=2')).toBe(false)
    expect(sameLink('https://youtu.be/x?t=90', 'https://youtu.be/x')).toBe(false)
  })

  it('does not confuse two hosts, two paths or two schemes', () => {
    expect(sameLink('https://x.dev/a', 'https://y.dev/a')).toBe(false)
    expect(sameLink('https://x.dev/a', 'https://x.dev/b')).toBe(false)
    expect(sameLink('https://x.dev/a', 'http://x.dev/a')).toBe(false)
  })

  it('falls back to the plain string when the URL will not parse', () => {
    expect(comparableUrl('  Not A Url ')).toBe('not a url')
    expect(sameLink('not a url', 'NOT A URL')).toBe(true)
  })
})

describe('cleanLinkUrl — the awkward shapes', () => {
  it('keeps a fragment exactly as written while cutting the query', () => {
    expect(cleanLinkUrl('https://x.dev/a?utm_source=n&b=1#a&b?c'))
      .toBe('https://x.dev/a?b=1#a&b?c')
  })

  it('leaves a query that only lives inside the fragment alone', () => {
    expect(cleanLinkUrl('https://x.dev/a#/route?utm_source=n')).toBe('https://x.dev/a#/route?utm_source=n')
  })

  it('handles an empty or valueless pair without inventing one', () => {
    expect(cleanLinkUrl('https://x.dev/a?&utm_source=n')).toBe('https://x.dev/a')
    expect(cleanLinkUrl('https://x.dev/a?utm_source')).toBe('https://x.dev/a')
    expect(cleanLinkUrl('https://x.dev/a?UTM_SOURCE=n&b=1')).toBe('https://x.dev/a?b=1')
  })

  // Narrow on purpose: this list rewrites what gets kept, and `ref` and
  // `source` are load-bearing on real sites.
  it('does not strip the ambiguous names, though comparison ignores them', () => {
    expect(cleanLinkUrl('https://api.github.com/repos/a/b/contents/f?ref=main'))
      .toBe('https://api.github.com/repos/a/b/contents/f?ref=main')
    expect(cleanLinkUrl('https://x.dev/p?source=post_page')).toBe('https://x.dev/p?source=post_page')
    expect(sameLink('https://x.dev/p', 'https://x.dev/p?source=post_page')).toBe(true)
  })
})

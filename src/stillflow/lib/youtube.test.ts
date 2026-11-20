import { describe, expect, it } from 'vitest'
import {
  androidIntentUrl, canonicalUrl, detectPlatform, embedUrl, parseVideoId, practiceHref, searchUrl, thumbnailUrl,
} from './youtube'

const ID = 'abcDEF12_-x'

describe('parseVideoId', () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=30s`],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`],
    [`https://youtu.be/${ID}?si=xyz`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}?rel=0`],
    [`https://www.youtube.com/live/${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`  youtu.be/${ID}  `],
  ])('reads %s', (input) => {
    expect(parseVideoId(input)).toBe(ID)
  })

  it.each([
    [''],
    ['not a url'],
    ['https://vimeo.com/123456789'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://evil.example/watch?v=abcDEF12_-x'],
    ['https://youtu.be/'],
  ])('rejects %s', (input) => {
    expect(parseVideoId(input)).toBeNull()
  })
})

describe('URL builders', () => {
  it('builds the canonical watch URL, thumbnail and privacy-enhanced embed', () => {
    expect(canonicalUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
    expect(embedUrl(ID)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12_-x\?/)
  })

  it('encodes search queries', () => {
    expect(searchUrl('hips & back')).toBe('https://www.youtube.com/results?search_query=hips%20%26%20back')
  })

  it('builds an Android intent that names the YouTube app and falls back to https', () => {
    const url = canonicalUrl(ID)
    const intent = androidIntentUrl(url)
    expect(intent.startsWith(`intent://www.youtube.com/watch?v=${ID}#Intent;`)).toBe(true)
    expect(intent).toContain('scheme=https')
    expect(intent).toContain('package=com.google.android.youtube')
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(url)}`)
    expect(intent.endsWith(';end')).toBe(true)
  })
})

describe('platform handling', () => {
  const android = 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

  it('detects platforms, including iPadOS posing as a Mac', () => {
    expect(detectPlatform(android)).toBe('android')
    expect(detectPlatform(iphone)).toBe('ios')
    expect(detectPlatform(mac, 0)).toBe('desktop')
    expect(detectPlatform(mac, 5)).toBe('ios')
  })

  it('uses the intent only on Android in auto mode, never a youtube:// scheme', () => {
    const url = canonicalUrl(ID)
    expect(practiceHref(url, 'android', 'auto').startsWith('intent://')).toBe(true)
    expect(practiceHref(url, 'android', 'link')).toBe(url)
    expect(practiceHref(url, 'ios', 'auto')).toBe(url)
    expect(practiceHref(url, 'desktop', 'auto')).toBe(url)
    for (const p of ['android', 'ios', 'desktop'] as const) {
      expect(practiceHref(url, p, 'auto')).not.toMatch(/^youtube:/)
    }
  })
})

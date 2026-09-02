import { describe, it, expect } from 'vitest'
import { mayFetchPreview } from './linkPrivacy'

describe('mayFetchPreview', () => {
  it('asks the relay about an ordinary public page', () => {
    expect(mayFetchPreview('https://www.thisiscolossal.com/2026/08/minyoung-kim/')).toBe(true)
    expect(mayFetchPreview('http://example.co.uk/a/b?page=2#part-3')).toBe(true)
    expect(mayFetchPreview('https://example.com:8443/a')).toBe(true)
  })

  it('never sends a URL that carries its own credential', () => {
    expect(mayFetchPreview('https://user:hunter2@example.com/doc')).toBe(false)
    expect(mayFetchPreview('https://example.com/doc?token=abc123')).toBe(false)
    expect(mayFetchPreview('https://example.com/doc?access_token=abc')).toBe(false)
    expect(mayFetchPreview('https://example.com/reset?code=99&user=me')).toBe(false)
    expect(mayFetchPreview('https://example.com/f?X-Amz-Signature=deadbeef')).toBe(false)
    expect(mayFetchPreview('https://example.com/app#access_token=abc&state=1')).toBe(false)
  })

  it('never sends somewhere only this device can reach', () => {
    for (const url of [
      'http://localhost:5173/a',
      'http://127.0.0.1/a',
      'http://192.168.1.4/photos',
      'http://10.0.0.9/a',
      'http://172.20.3.1/a',
      'http://nas.local/share',
      'http://wiki.internal/page',
      'http://intranet/page',
      'http://[::1]:8080/a',
    ]) {
      expect(mayFetchPreview(url)).toBe(false)
    }
  })

  it('only ever speaks http', () => {
    expect(mayFetchPreview('file:///home/me/notes.html')).toBe(false)
    expect(mayFetchPreview('data:text/html,<p>hi</p>')).toBe(false)
    expect(mayFetchPreview('obsidian://open?vault=mine')).toBe(false)
  })

  it('says no to nothing at all, or to what will not parse', () => {
    expect(mayFetchPreview(null)).toBe(false)
    expect(mayFetchPreview(undefined)).toBe(false)
    expect(mayFetchPreview('')).toBe(false)
    expect(mayFetchPreview('not a url')).toBe(false)
  })

  // The bias is one-directional and deliberate: a withheld preview costs a
  // thumbnail, a sent one cannot be taken back.
  it('does not read a credential into an ordinary word', () => {
    expect(mayFetchPreview('https://example.com/keyboards?sort=price')).toBe(true)
    expect(mayFetchPreview('https://example.com/a?monkey=1')).toBe(true)
    expect(mayFetchPreview('https://example.com/a?sourceid=chrome')).toBe(true)
  })
})

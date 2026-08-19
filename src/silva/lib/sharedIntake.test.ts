import { describe, it, expect } from 'vitest'
import { parseSharedIntake, urlWithoutShare } from './sharedIntake'

describe('parseSharedIntake', () => {
  it('returns null when nothing was shared', () => {
    expect(parseSharedIntake('')).toBeNull()
    expect(parseSharedIntake('?')).toBeNull()
  })

  it('takes a shared selection as the body', () => {
    expect(parseSharedIntake('?text=We%20are%20what%20we%20repeatedly%20do'))
      .toEqual({ body: 'We are what we repeatedly do', locator: '' })
  })

  it('takes a shared page as body plus locator', () => {
    expect(parseSharedIntake('?text=a%20passage&url=https%3A%2F%2Fexample.com%2Fessay'))
      .toEqual({ body: 'a passage', locator: 'https://example.com/essay' })
  })

  // Several Android share sheets put the URL in `text` and leave `url` empty.
  it('treats a bare URL in `text` as the locator, not as the passage', () => {
    expect(parseSharedIntake('?text=https%3A%2F%2Fexample.com%2Fessay'))
      .toEqual({ body: '', locator: 'https://example.com/essay' })
  })

  it('keeps a bare link even with no words — the body is left for you to say why', () => {
    const result = parseSharedIntake('?url=https%3A%2F%2Fexample.com')
    expect(result).toEqual({ body: '', locator: 'https://example.com' })
  })

  it('adds the title when it carries something the text does not', () => {
    expect(parseSharedIntake('?text=a%20quoted%20line&title=The%20Essay'))
      .toEqual({ body: 'a quoted line\n\nThe Essay', locator: '' })
  })

  // Sharing a selection often sends the title duplicated into the text.
  it('does not repeat a title that already opens the shared text', () => {
    expect(parseSharedIntake('?text=The%20Essay%20—%20and%20then%20some&title=The%20Essay'))
      .toEqual({ body: 'The Essay — and then some', locator: '' })
  })

  it('uses the title alone when that is all that arrived', () => {
    expect(parseSharedIntake('?title=A%20thought')).toEqual({ body: 'A thought', locator: '' })
  })

  it('trims whitespace-only parameters away', () => {
    expect(parseSharedIntake('?text=%20%20&url=%20%20')).toBeNull()
  })

  it('ignores query parameters that are not a share', () => {
    expect(parseSharedIntake('?utm_source=newsletter')).toBeNull()
  })

  it('keeps a multi-line shared passage intact', () => {
    const result = parseSharedIntake(`?text=${encodeURIComponent('first line\nsecond line')}`)
    expect(result?.body).toBe('first line\nsecond line')
  })
})

describe('urlWithoutShare', () => {
  it('strips the query so a refresh cannot re-add what you already kept', () => {
    expect(urlWithoutShare('https://example.com/silva-react.html?text=hi'))
      .toBe('https://example.com/silva-react.html')
  })

  it('leaves the path and hash alone', () => {
    expect(urlWithoutShare('https://example.com/silva-react.html?text=hi#forest'))
      .toBe('https://example.com/silva-react.html#forest')
  })

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(urlWithoutShare('not a url')).toBe('not a url')
  })
})

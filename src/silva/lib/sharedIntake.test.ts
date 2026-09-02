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
  // A share carrying nothing but that URL becomes the *body*, exactly as a
  // pasted URL does: `intakeFields` moves it into `link`, and Keep swaps it
  // for the article's own title. Left in the locator with an empty body, the
  // thing had a blank headline nothing could ever fill.
  it('takes a wordless share as the body, so the title can land on it later', () => {
    expect(parseSharedIntake('?text=https%3A%2F%2Fexample.com%2Fessay'))
      .toEqual({ body: 'https://example.com/essay', locator: '' })
  })

  it('keeps a bare link even with no words at all', () => {
    const result = parseSharedIntake('?url=https%3A%2F%2Fexample.com')
    expect(result).toEqual({ body: 'https://example.com', locator: '' })
  })

  // What most Android apps actually send: one `text` with the words and the
  // link together, and no `url` parameter at all.
  it('splits a link off the end of the shared text', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('Some video title\nhttps://youtu.be/x')}`))
      .toEqual({ body: 'Some video title', locator: 'https://youtu.be/x' })
  })

  it('splits a link off the start of the shared text', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('https://youtu.be/x Some video title')}`))
      .toEqual({ body: 'Some video title', locator: 'https://youtu.be/x' })
  })

  // The narrowness is the point — a URL inside a sentence is a sentence.
  it('leaves a URL in the middle of the text alone', () => {
    const text = 'he cites https://example.com/essay twice'
    expect(parseSharedIntake(`?text=${encodeURIComponent(text)}`))
      .toEqual({ body: text, locator: '' })
  })

  it('does not choose between two shared links', () => {
    const text = 'https://example.com/one https://example.com/two'
    expect(parseSharedIntake(`?text=${encodeURIComponent(text)}`))
      .toEqual({ body: text, locator: '' })
  })

  // A URL read out of prose carries the sentence's punctuation with it —
  // kept, that is a link that 404s, printed on a label and saved forever.
  it('leaves the sentence punctuation behind when it splits a link out', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('Read this https://x.dev/a.')}`))
      .toEqual({ body: 'Read this', locator: 'https://x.dev/a' })
    expect(parseSharedIntake(`?text=${encodeURIComponent('https://x.dev/a! Extraordinary')}`))
      .toEqual({ body: 'Extraordinary', locator: 'https://x.dev/a' })
    expect(parseSharedIntake(`?text=${encodeURIComponent('https://x.dev/a?q=1"')}`))
      .toEqual({ body: 'https://x.dev/a?q=1', locator: '' })
  })

  // Half of Wikipedia addresses itself with a bracket.
  it('keeps a closing bracket the URL opened itself', () => {
    const url = 'https://en.wikipedia.org/wiki/Mercury_(planet)'
    expect(parseSharedIntake(`?text=${encodeURIComponent(`${url} is the one`)}`))
      .toEqual({ body: 'is the one', locator: url })
    // And a URL wrapped in brackets never starts a word, so it is never a
    // link at the edge of the text at all — it stays the sentence it is in.
    const bracketed = 'see (https://x.dev/a)'
    expect(parseSharedIntake(`?text=${encodeURIComponent(bracketed)}`))
      .toEqual({ body: bracketed, locator: '' })
  })

  // "Some title —" is a dash pointing at nothing once the link has moved.
  it('takes the joiner off the words it split from the link', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('Some title — https://x.dev/a')}`))
      .toEqual({ body: 'Some title', locator: 'https://x.dev/a' })
    expect(parseSharedIntake(`?text=${encodeURIComponent('Some title | https://x.dev/a')}`))
      .toEqual({ body: 'Some title', locator: 'https://x.dev/a' })
  })

  // A colon is left: "worth a read:" is a sentence, and what it introduces
  // is the link itself.
  it('leaves a colon where a sentence put it', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('worth a read: https://x.dev/a')}`))
      .toEqual({ body: 'worth a read:', locator: 'https://x.dev/a' })
  })

  // Nothing but a joiner and a link is a wordless share wearing a dash.
  it('falls through to the wordless rule when the joiner was all there was', () => {
    expect(parseSharedIntake(`?text=${encodeURIComponent('— https://x.dev/a')}`))
      .toEqual({ body: 'https://x.dev/a', locator: '' })
  })

  // An app that filled `url` has already said which part is the link; the
  // text is then whatever it chose to say about it, untouched.
  it('does not split the text when the share carried its own url', () => {
    const search = `?text=${encodeURIComponent('read this https://example.com/other')}&url=${encodeURIComponent('https://example.com/essay')}`
    expect(parseSharedIntake(search))
      .toEqual({ body: 'read this https://example.com/other', locator: 'https://example.com/essay' })
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

  it('does not repeat a title buried inside the shared text either', () => {
    expect(parseSharedIntake('?text=and%20then%20The%20Essay%20came%20up&title=The%20Essay'))
      .toEqual({ body: 'and then The Essay came up', locator: '' })
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

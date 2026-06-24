import { test, expect, describe } from 'vitest'
import { buildExportHtml } from './exportHtml.js'

const entries = [
  { id: '1', date: '2026-06-22', title: 'rain on the awning', entry: 'a tiny drum', tags: ['rain'], people: [], wordCount: 3 },
  { id: '2', date: '2026-06-24', title: 'the espresso foam', entry: 'it held its <shape>', tags: ['light'], people: ['Mara'], wordCount: 4 },
]

describe('buildExportHtml', () => {
  const html = buildExportHtml(entries, new Date(2026, 5, 24))

  test('is a complete standalone document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('Journal of <em>Delights</em>')
  })
  test('includes every entry, newest first', () => {
    expect(html.indexOf('the espresso foam')).toBeLessThan(html.indexOf('rain on the awning'))
  })
  test('escapes HTML in user content (no injection)', () => {
    expect(html).toContain('it held its &lt;shape&gt;')
    expect(html).not.toContain('it held its <shape>')
  })
  test('bakes in inline SVGs for the field labels', () => {
    expect(html).toContain('<svg')
    expect(html).toContain('people')
    expect(html).toContain('tags')
  })
  test('renders chips and word counts', () => {
    expect(html).toContain('class="chip person">Mara')
    expect(html).toContain('4 words')
  })
  test('needs no external scripts', () => {
    expect(html).not.toContain('<script')
  })
})

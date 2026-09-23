import { describe, expect, it, vi } from 'vitest'
import { canShareReport, shareReport } from './shareReport'

describe('shareReport', () => {
  it('hands the report to the share sheet as text, with a line saying what it is', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await shareReport('{"a":1}', { share })).toBe('shared')
    const { text, title } = share.mock.calls[0][0]
    expect(title).toBe('KeyPath probe report')
    expect(text).toMatch(/^KeyPath probe report/)
    expect(text).toContain('{"a":1}')
  })

  it('treats closing the sheet as a cancel, not an error', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('closed'), { name: 'AbortError' }))
    expect(await shareReport('{}', { share })).toBe('cancelled')
  })

  it('reports other failures as errors', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { name: 'NotAllowedError' }))
    expect(await shareReport('{}', { share })).toBe('error')
  })

  it('knows when there is no share sheet', async () => {
    expect(canShareReport({} as Navigator)).toBe(false)
    expect(await shareReport('{}', {} as Navigator)).toBe('unsupported')
  })
})

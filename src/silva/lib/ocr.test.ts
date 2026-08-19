import { describe, it, expect, vi } from 'vitest'
import { ocrPhoto } from './ocr'

function stubFetchWithText(text: string) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }),
  )
}

const BLOB = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' })

describe('ocrPhoto', () => {
  it('returns "" without a key, never calling fetch', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await ocrPhoto('', BLOB)
    expect(result).toBe('')
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('returns the transcribed text on a legible page', async () => {
    vi.stubGlobal('fetch', stubFetchWithText('The unexamined life is not worth living.'))
    const result = await ocrPhoto('sk-ant-test', BLOB)
    expect(result).toBe('The unexamined life is not worth living.')
    vi.unstubAllGlobals()
  })

  it('returns "" — not a description — when the model reports no text', async () => {
    vi.stubGlobal('fetch', stubFetchWithText('NONE'))
    const result = await ocrPhoto('sk-ant-test', BLOB)
    expect(result).toBe('')
    vi.unstubAllGlobals()
  })

  it('treats the sentinel case-insensitively', async () => {
    vi.stubGlobal('fetch', stubFetchWithText('none'))
    const result = await ocrPhoto('sk-ant-test', BLOB)
    expect(result).toBe('')
    vi.unstubAllGlobals()
  })

  it('returns "" on a non-ok response rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    const result = await ocrPhoto('sk-ant-bad', BLOB)
    expect(result).toBe('')
    vi.unstubAllGlobals()
  })

  it('returns "" on a network failure rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await ocrPhoto('sk-ant-test', BLOB)
    expect(result).toBe('')
    vi.unstubAllGlobals()
  })

  it('sends the image as a base64 content block alongside the prompt', async () => {
    const fetchImpl = stubFetchWithText('Some text')
    vi.stubGlobal('fetch', fetchImpl)
    await ocrPhoto('sk-ant-test', BLOB, 'image/png')
    const [, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init.body)
    const content = body.messages[0].content
    expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } })
    expect(typeof content[0].source.data).toBe('string')
    expect(content[1].type).toBe('text')
    vi.unstubAllGlobals()
  })
})

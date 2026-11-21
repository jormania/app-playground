import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareFile } from './share.js'

describe('shareFile', () => {
  afterEach(() => vi.unstubAllGlobals())
  const file = new File(['{}'], 'b.json', { type: 'application/json' })

  it('reports unsupported where files can’t be shared, so the caller downloads', async () => {
    vi.stubGlobal('navigator', { share: vi.fn() })
    expect(await shareFile(file)).toEqual({ ok: false, unsupported: true })
  })

  it('shares the file, and treats a dismissed sheet as cancelled', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await shareFile(file, 'Backup')).toEqual({ ok: true, shared: true })
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Backup' })
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await shareFile(file)).toEqual({ ok: true, cancelled: true })
  })
})

// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOnce } from './useOnce'

describe('useOnce', () => {
  it('lets a second tap go while the first is still saving, and takes the next one after', async () => {
    const { result } = renderHook(() => useOnce())
    let saves = 0
    let finish = () => {}
    const save = result.current(() => {
      saves++
      return new Promise<void>((r) => (finish = r))
    })
    const first = save()
    void save()
    void save()
    finish()
    await first
    expect(saves).toBe(1)
    const again = save()
    finish()
    await again
    expect(saves).toBe(2)
  })

  it('takes the next tap after a save that fails', async () => {
    const { result } = renderHook(() => useOnce())
    let calls = 0
    const save = result.current(async () => {
      calls++
      if (calls === 1) throw new Error('full')
    })
    await expect(save()).rejects.toThrow('full')
    await save()
    expect(calls).toBe(2)
  })
})

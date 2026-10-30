// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// The hook is the optimistic layer over whichever client store.js hands it, so the
// client is faked here; the stub shape of the real ones is in localClient.js (R-017).
let client
let live = false
vi.mock('./store.js', () => ({
  getClient: () => client,
  isLive: () => live,
}))

import { useLoom } from './useLoom.js'

const T1 = { id: 'a', title: 'One', skein: null, day: null, order: 0, done: false }

// Rejects on a later macrotask, as a network failure does: the optimistic render
// (which is what captures the previous thread to revert to) has flushed by then.
const failLater = message => () => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 0))

const makeClient = (over = {}) => ({
  listThreads: vi.fn(async () => [T1]),
  createThread: vi.fn(async t => ({ ...t, id: 'real-1' })),
  updateThread: vi.fn(async () => {}),
  removeThread: vi.fn(async () => {}),
  ...over,
})

const ready = async (over) => {
  client = makeClient(over)
  const hook = renderHook(() => useLoom())
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

beforeEach(() => { live = false })
afterEach(() => { vi.useRealTimers() })

describe('loading', () => {
  it('lists threads from the client and reports ready', async () => {
    const { result } = await ready()
    expect(result.current.status).toBe('ready')
    expect(result.current.threads).toEqual([T1])
  })

  it('reports an error with the failure message when the list fails', async () => {
    const { result } = await ready({ listThreads: vi.fn(async () => { throw new Error('nope') }) })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('nope')
  })

  it('falls back to a default message when the failure carries none', async () => {
    const { result } = await ready({ listThreads: vi.fn(async () => { throw {} }) })
    expect(result.current.error).toBe('Could not reach the loom.')
  })

  it('reports mode from isLive, and reload fetches again', async () => {
    live = true
    const { result } = await ready()
    expect(result.current.mode).toBe('live')
    await act(async () => { await result.current.reload() })
    expect(client.listThreads).toHaveBeenCalledTimes(2)
  })
})

describe('addThread', () => {
  it('shows a pending temp thread at once, then swaps in the saved one', async () => {
    let resolve
    const { result } = await ready({ createThread: vi.fn(() => new Promise(r => { resolve = r })) })
    let tmp
    act(() => { tmp = result.current.addThread({ title: 'New' }) })
    expect(tmp).toMatch(/^tmp-/)
    const optimistic = result.current.threads.find(t => t.id === tmp)
    expect(optimistic).toMatchObject({ title: 'New', pending: true, done: false, order: 0, skein: null })
    await act(async () => { resolve({ title: 'New', id: 'real-9' }) })
    expect(result.current.threads.find(t => t.id === 'real-9')).toMatchObject({ pending: false })
    expect(result.current.threads.some(t => t.id === tmp)).toBe(false)
  })

  it('hands out distinct temp ids within one tick', async () => {
    const { result } = await ready()
    let a, b
    act(() => { a = result.current.addThread({ title: 'x' }); b = result.current.addThread({ title: 'y' }) })
    expect(a).not.toBe(b)
  })

  it('rolls back and flashes the message when the create fails', async () => {
    const { result } = await ready({ createThread: vi.fn(async () => { throw new Error('refused') }) })
    await act(async () => { result.current.addThread({ title: 'New' }) })
    expect(result.current.threads).toEqual([T1])
    expect(result.current.error).toBe('refused')
  })
})

describe('patchThread', () => {
  it('applies the change at once and persists it', async () => {
    const { result } = await ready()
    await act(async () => { result.current.patchThread('a', { title: 'Two' }) })
    expect(result.current.threads[0].title).toBe('Two')
    expect(client.updateThread).toHaveBeenCalledWith('a', { title: 'Two' })
  })

  it('does not call the client for a thread whose create is still in flight', async () => {
    const { result } = await ready({ createThread: vi.fn(() => new Promise(() => {})) })
    let tmp
    act(() => { tmp = result.current.addThread({ title: 'New' }) })
    act(() => { result.current.patchThread(tmp, { title: 'Newer' }) })
    expect(result.current.threads.find(t => t.id === tmp).title).toBe('Newer')
    expect(client.updateThread).not.toHaveBeenCalled()
  })

  it('reverts to the previous thread and flashes when the save fails', async () => {
    const { result } = await ready({ updateThread: vi.fn(failLater('conflict')) })
    act(() => { result.current.patchThread('a', { title: 'Two' }) })
    await act(async () => { await new Promise(r => setTimeout(r, 5)) })
    expect(result.current.threads[0]).toEqual(T1)
    expect(result.current.error).toBe('conflict')
  })

  it('toggleWoven patches done', async () => {
    const { result } = await ready()
    await act(async () => { result.current.toggleWoven('a', true) })
    expect(client.updateThread).toHaveBeenCalledWith('a', { done: true })
    expect(result.current.threads[0].done).toBe(true)
  })
})

describe('removeThread', () => {
  it('removes at once and persists', async () => {
    const { result } = await ready()
    await act(async () => { result.current.removeThread('a') })
    expect(result.current.threads).toEqual([])
    expect(client.removeThread).toHaveBeenCalledWith('a')
  })

  it('restores the thread and flashes when the delete fails', async () => {
    const { result } = await ready({ removeThread: vi.fn(failLater('locked')) })
    act(() => { result.current.removeThread('a') })
    await act(async () => { await new Promise(r => setTimeout(r, 5)) })
    expect(result.current.threads).toEqual([T1])
    expect(result.current.error).toBe('locked')
  })

  it('never calls the client for a temp id', async () => {
    const { result } = await ready({ createThread: vi.fn(() => new Promise(() => {})) })
    let tmp
    act(() => { tmp = result.current.addThread({ title: 'New' }) })
    act(() => { result.current.removeThread(tmp) })
    expect(client.removeThread).not.toHaveBeenCalled()
    expect(result.current.threads).toEqual([T1])
  })
})

describe('the flashed error', () => {
  const fail = async result => {
    act(() => { result.current.patchThread('a', { title: 'Two' }) })
    await act(async () => { await new Promise(r => setTimeout(r, 5)) })
  }

  it('clears itself after a few seconds', async () => {
    const { result } = await ready({ updateThread: vi.fn(failLater('conflict')) })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    act(() => { result.current.patchThread('a', { title: 'Two' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.error).toBe('conflict')
    await act(async () => { await vi.advanceTimersByTimeAsync(4300) })
    expect(result.current.error).toBe('')
  })

  it('dismissError clears it sooner', async () => {
    const { result } = await ready({ updateThread: vi.fn(failLater('conflict')) })
    await fail(result)
    expect(result.current.error).toBe('conflict')
    act(() => { result.current.dismissError() })
    expect(result.current.error).toBe('')
  })
})

// The store hook. Loom is local-first: the thread array in React state is what
// the UI renders and mutates instantly (so drags, swipes and typing never wait
// on the network); the active client (demo localStorage OR live Notion) is the
// backing store written through in the background. A failed live write reverts
// the optimistic change and surfaces a short message — nothing is silently lost.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient, isLive } from './store.js'

let tmpSeq = 0
const tempId = () => `tmp-${Date.now().toString(36)}-${tmpSeq++}`
const isTemp = id => typeof id === 'string' && id.startsWith('tmp-')

export function useLoom() {
  const [threads, setThreads] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('')
  const clientRef = useRef(null)
  const mountedRef = useRef(true)

  // Fresh client each load so just-saved Settings take effect without a reload.
  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    const client = getClient()
    clientRef.current = client
    try {
      const list = await client.listThreads()
      if (!mountedRef.current) return
      setThreads(list)
      setStatus('ready')
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.message || 'Could not reach the loom.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const flash = useCallback((msg) => {
    setError(msg)
    // Let it linger a few seconds, then clear if nothing newer replaced it.
    const shown = msg
    setTimeout(() => { if (mountedRef.current) setError(cur => (cur === shown ? '' : cur)) }, 4200)
  }, [])

  // ── Mutations (optimistic local, background persist) ───────────────────────

  // `thread` carries title/skein/day/order/done; id is assigned here.
  const addThread = useCallback((thread) => {
    const tmp = tempId()
    const optimistic = { skein: null, day: null, order: 0, done: false, ...thread, id: tmp, pending: true }
    setThreads(cur => [...cur, optimistic])
    ;(async () => {
      try {
        const saved = await clientRef.current.createThread(thread)
        if (!mountedRef.current) return
        setThreads(cur => cur.map(t => (t.id === tmp ? { ...saved, pending: false } : t)))
      } catch (err) {
        if (!mountedRef.current) return
        setThreads(cur => cur.filter(t => t.id !== tmp)) // roll back
        flash(err?.message || 'That thread didn’t take — try again.')
      }
    })()
    return tmp
  }, [flash])

  const patchThread = useCallback((id, patch) => {
    let prev = null
    setThreads(cur => cur.map(t => {
      if (t.id !== id) return t
      prev = t
      return { ...t, ...patch }
    }))
    if (isTemp(id)) return // create still in flight; its result carries final state
    ;(async () => {
      try {
        await clientRef.current.updateThread(id, patch)
      } catch (err) {
        if (!mountedRef.current || !prev) return
        setThreads(cur => cur.map(t => (t.id === id ? prev : t))) // revert
        flash(err?.message || 'Couldn’t save that change.')
      }
    })()
  }, [flash])

  const removeThread = useCallback((id) => {
    let removed = null
    setThreads(cur => cur.filter(t => {
      if (t.id === id) { removed = t; return false }
      return true
    }))
    if (isTemp(id)) return
    ;(async () => {
      try {
        await clientRef.current.removeThread(id)
      } catch (err) {
        if (!mountedRef.current || !removed) return
        setThreads(cur => [...cur, removed]) // restore
        flash(err?.message || 'Couldn’t unravel that one.')
      }
    })()
  }, [flash])

  const toggleWoven = useCallback((id, done) => patchThread(id, { done }), [patchThread])

  return {
    threads,
    status,
    error,
    mode: isLive() ? 'live' : 'demo',
    addThread,
    patchThread,
    removeThread,
    toggleWoven,
    reload: load,
    dismissError: () => setError(''),
  }
}

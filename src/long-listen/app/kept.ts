import { useCallback, useState } from 'react'
import { readJson, readSessionJson, removeJson, removeSessionJson, writeJson, writeSessionJson } from '../../shared/storage'

const PREFIX = 'long-listen:kept:'

/**
 * A piece of what the listener set or typed that should still be there when
 * they come back: a search (`'tab'`, for the tab's life) or a sentence not yet
 * sent (`'device'`, until it is sent or emptied — a phone closes a tab without
 * asking). Emptied, it is forgotten rather than kept as an empty string.
 */
export function useKept(key: string, where: 'tab' | 'device'): [string, (v: string) => void, () => void, (v: string) => void] {
  const full = PREFIX + key
  const read = () => {
    const v = where === 'tab' ? readSessionJson<unknown>(full, '') : readJson<unknown>(full, '')
    return typeof v === 'string' ? v : ''
  }
  const [held, setHeld] = useState(() => ({ key: full, value: read() }))
  // Another work, another draft: the one kept under the new key, read as the key changes.
  let value = held.value
  if (held.key !== full) { value = read(); setHeld({ key: full, value }) }
  const setValue = useCallback((v: string) => setHeld({ key: full, value: v }), [full])
  const set = useCallback((v: string) => {
    setValue(v)
    if (v.trim()) {
      if (where === 'tab') writeSessionJson(full, v)
      else writeJson(full, v)
    } else forget(full, where)
  }, [full, where, setValue])
  const clear = useCallback(() => { setValue(''); forget(full, where) }, [full, where, setValue])
  // What is already kept elsewhere (a saved note, shown for editing) is shown, not kept again as a draft.
  const show = useCallback((v: string) => { setValue(v); forget(full, where) }, [full, where, setValue])
  return [value, set, clear, show]
}

/**
 * Set what a kept field will hold before its page opens — a performer's name
 * tapped elsewhere becomes the Library's search, as if typed there.
 */
export function keepAhead(key: string, where: 'tab' | 'device', value: string): void {
  const full = PREFIX + key
  if (!value.trim()) { forget(full, where); return }
  if (where === 'tab') writeSessionJson(full, value)
  else writeJson(full, value)
}

function forget(full: string, where: 'tab' | 'device'): void {
  if (where === 'tab') removeSessionJson(full)
  else removeJson(full)
}

/**
 * A journey replaced (a fresh start, a backup restored): what was typed and
 * not sent, and the places kept on pages of the old journey, belong to it —
 * a draft left would otherwise stand in front of the restored text, and be
 * saved into the new journey with the next tap.
 */
export function forgetPlaces(): void {
  for (const store of [safe(() => localStorage), safe(() => sessionStorage)]) {
    if (!store) continue
    try {
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && (k.startsWith(PREFIX) || k === 'long-listen:trail' || k === 'long-listen:open-folds' || k === 'long-listen:last-listen')) keys.push(k) }
      for (const k of keys) store.removeItem(k)
    } catch { /* storage unavailable: nothing kept */ }
  }
}

function safe(get: () => Storage): Storage | undefined {
  try { return get() } catch { return undefined }
}

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

function forget(full: string, where: 'tab' | 'device'): void {
  if (where === 'tab') removeSessionJson(full)
  else removeJson(full)
}

/**
 * Web storage that can't take the app down.
 *
 * Safari in private mode (and any browser at its quota) throws on `setItem`, and an
 * unguarded write inside a React effect is an uncaught render error. Reads were
 * already defensive in the original; writes were not.
 *
 * Promoted out of src/where-it-went/lib/storage.js — that file now re-exports these
 * so its own import paths are unchanged.
 *
 * Note for tests: `npm test` sets NODE_OPTIONS=--no-experimental-webstorage. Running
 * `vitest` bare lets Node's native localStorage shadow the DOM environment's, and
 * every test touching these helpers fails in a way that looks like a real
 * regression but isn't. See CLAUDE.md.
 */

export function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return fallback
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return false
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeJson(key: string): void {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return
    localStorage.removeItem(key)
  } catch {
    // Nothing to do — worst case the stale value lingers.
  }
}

/**
 * Session-scoped counterpart, for anyone who'd rather this device forget the
 * Notion token once the tab closes (Settings → "Remember me on this device",
 * off). Same shape and same defensiveness as the localStorage versions above.
 */
export function readSessionJson<T>(key: string, fallback: T): T {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return fallback
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

export function writeSessionJson(key: string, value: unknown): boolean {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return false
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeSessionJson(key: string): void {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return
    sessionStorage.removeItem(key)
  } catch {
    // Nothing to do — worst case the stale value lingers.
  }
}

/**
 * localStorage that can't take the app down.
 *
 * Safari in private mode (and any browser at its quota) throws on `setItem`, and an
 * unguarded write inside a React effect is an uncaught render error. Reads were
 * already defensive; writes were not.
 */
export function readJson(key, fallback) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeJson(key) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.removeItem(key);
  } catch {
    // Nothing to do — worst case the stale value lingers.
  }
}

/**
 * Session-scoped counterpart, for anyone who'd rather this device forget the
 * Notion token once the tab closes (Settings → "Remember me on this device",
 * off). Same shape and same defensiveness as the localStorage versions above.
 */
export function readSessionJson(key, fallback) {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return fallback;
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionJson(key, value) {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return false;
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeSessionJson(key) {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return;
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to do — worst case the stale value lingers.
  }
}

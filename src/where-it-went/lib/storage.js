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

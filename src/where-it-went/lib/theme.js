/**
 * First-run theme default.
 *
 * The app always opened in dark theme regardless of the device's own setting
 * — every other themed app in this repo (Journal, Wanderlist, Sol Odyssey,
 * Daily Stoic) seeds its initial theme from the OS instead. Only used before
 * any explicit choice has been saved; once `config.theme` exists it always wins.
 */
export function systemPrefersDark() {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function defaultTheme() {
  return systemPrefersDark() ? 'dark' : 'light';
}

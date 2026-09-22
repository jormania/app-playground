import { systemPrefersDark } from '../../shared/theme.ts'
/**
 * First-run theme default.
 *
 * The app always opened in dark theme regardless of the device's own setting
 * — every other themed app in this repo (Journal, Wanderlist, Sol Odyssey,
 * Daily Stoic) seeds its initial theme from the OS instead. Only used before
 * any explicit choice has been saved; once `config.theme` exists it always wins.
 */
// The matchMedia probe is the shared one now (R-015) — seven apps had written
// out the same seven lines. Re-exported so this module's API is unchanged.
export { systemPrefersDark }

export function defaultTheme() {
  return systemPrefersDark() ? 'dark' : 'light';
}

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_KEY,
  THEME_COLORS,
  loadTheme,
  saveTheme,
  normalizeTheme,
  resolveTheme,
  type ThemePref,
} from './theme';

function memStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('theme preference', () => {
  it('defaults to following the system', () => {
    expect(DEFAULT_THEME).toBe('system');
    expect(loadTheme(memStore())).toBe('system');
    expect(loadTheme(memStore({ [THEME_KEY]: 'nonsense' }))).toBe('system');
  });

  it('keeps the three valid values', () => {
    for (const pref of ['system', 'light', 'dark'] as ThemePref[]) {
      expect(loadTheme(memStore({ [THEME_KEY]: pref }))).toBe(pref);
    }
  });

  it('migrates the retired palette ids to the right side of the line', () => {
    for (const id of ['indigo-dark', 'octagon', 'ristretto', 'spectrum']) {
      expect(normalizeTheme(id)).toBe('dark');
    }
    for (const id of ['indigo-light', 'quiet-light', 'filter-sun', 'solarized-light']) {
      expect(normalizeTheme(id)).toBe('light');
    }
  });

  it('round-trips through storage', () => {
    const store = memStore();
    saveTheme('dark', store);
    expect(loadTheme(store)).toBe('dark');
    saveTheme('system', store);
    expect(loadTheme(store)).toBe('system');
  });

  it('resolves an explicit choice without asking the OS', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('has a chrome colour for each resolved mode', () => {
    expect(THEME_COLORS.light).toMatch(/^#[0-9A-F]{6}$/i);
    expect(THEME_COLORS.dark).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

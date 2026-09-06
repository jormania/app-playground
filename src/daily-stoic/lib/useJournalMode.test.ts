// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  isHiddenInLite,
  useLiteActive,
  useJournalMode,
  fullDayKey,
  JOURNAL_MODE_KEY,
} from './useJournalMode';

// Node's experimental localStorage global shadows happy-dom's; same shim the
// journal tests use.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

afterEach(() => localStorage.clear());

const settingsChanged = () =>
  act(() => {
    window.dispatchEvent(new Event('daily-stoic:settings-updated'));
  });

describe('isHiddenInLite', () => {
  it('hides the dashboards Lite starves of input, in either route form', () => {
    for (const value of ['dichotomy', 'passions', 'commitments', 'council']) {
      expect(isHiddenInLite(value)).toBe(true);
      expect(isHiddenInLite(`/${value}`)).toBe(true);
    }
  });

  it('keeps the ones Lite still feeds', () => {
    for (const value of ['', '/', 'amorfati', 'digest', 'stats', 'memento', 'enchiridion', 'settings']) {
      expect(isHiddenInLite(value)).toBe(false);
    }
  });
});

describe('useJournalMode', () => {
  it('defaults to full and follows the setting', () => {
    const { result } = renderHook(() => useJournalMode());
    expect(result.current).toBe('full');

    localStorage.setItem(JOURNAL_MODE_KEY, 'lite');
    settingsChanged();
    expect(result.current).toBe('lite');
  });
});

describe('useLiteActive', () => {
  it('is false while the setting is off', () => {
    const { result } = renderHook(() => useLiteActive(5));
    expect(result.current).toBe(false);
  });

  it('turns on with the setting and off again', () => {
    const { result } = renderHook(() => useLiteActive(5));

    localStorage.setItem(JOURNAL_MODE_KEY, 'lite');
    settingsChanged();
    expect(result.current).toBe(true);

    localStorage.setItem(JOURNAL_MODE_KEY, 'full');
    settingsChanged();
    expect(result.current).toBe(false);
  });

  it('goes off for a day opened through the escape hatch, and only that day', () => {
    localStorage.setItem(JOURNAL_MODE_KEY, 'lite');
    localStorage.setItem(fullDayKey(5), 'true');

    const { result } = renderHook(() => useLiteActive(5));
    expect(result.current).toBe(false);

    const other = renderHook(() => useLiteActive(6));
    expect(other.result.current).toBe(true);
  });

  it('re-reads when the day changes', () => {
    localStorage.setItem(JOURNAL_MODE_KEY, 'lite');
    localStorage.setItem(fullDayKey(5), 'true');

    const { result, rerender } = renderHook(({ day }) => useLiteActive(day), {
      initialProps: { day: 5 },
    });
    expect(result.current).toBe(false);

    rerender({ day: 6 });
    expect(result.current).toBe(true);
  });
});

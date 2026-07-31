/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchRate,
  convert,
  impliedRate,
  formatRateNote,
  canConvert,
  cacheKey,
  clearRateCache,
  CURRENCIES,
  RATED_CURRENCIES,
  BASE_CURRENCY,
  orderedCurrencies,
  recordRecentCurrency,
} from './fx';

const okResponse = (body) => ({ ok: true, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  clearRateCache();
});

describe('currency vocabulary', () => {
  it('offers RON as the base', () => {
    expect(BASE_CURRENCY).toBe('RON');
    expect(CURRENCIES).toContain('RON');
  });

  it('keeps BGN offered but unrated — the ECB stopped quoting it', () => {
    // It must still be recordable (it's a registered Notion select option),
    // just never converted.
    expect(CURRENCIES).toContain('BGN');
    expect(RATED_CURRENCIES.has('BGN')).toBe(false);
    expect(canConvert('BGN')).toBe(false);
  });

  it('every rated currency is also offered in the picker', () => {
    for (const c of RATED_CURRENCIES) expect(CURRENCIES).toContain(c);
  });
});

describe('orderedCurrencies', () => {
  it('puts RON first with no priority or recents', () => {
    expect(orderedCurrencies()).toEqual(CURRENCIES);
  });

  it('floats a priority currency (the account/trip) right after RON', () => {
    expect(orderedCurrencies('JPY')[0]).toBe('RON');
    expect(orderedCurrencies('JPY')[1]).toBe('JPY');
  });

  it('never duplicates or drops a currency, whatever the priority', () => {
    const ordered = orderedCurrencies('EUR');
    expect(ordered).toHaveLength(CURRENCIES.length);
    expect(new Set(ordered).size).toBe(CURRENCIES.length);
    for (const c of CURRENCIES) expect(ordered).toContain(c);
  });

  it('ignores an unregistered or empty priority rather than inserting garbage', () => {
    expect(orderedCurrencies('XYZ')).toEqual(CURRENCIES);
    expect(orderedCurrencies('')).toEqual(CURRENCIES);
  });

  it('surfaces recently-used currencies after the priority slot', () => {
    recordRecentCurrency('JPY');
    recordRecentCurrency('USD');
    const ordered = orderedCurrencies();
    // Most-recent-first: USD was recorded last.
    expect(ordered.slice(0, 3)).toEqual(['RON', 'USD', 'JPY']);
  });

  it('never records RON as "recent" — it is always first regardless', () => {
    recordRecentCurrency('RON');
    expect(orderedCurrencies()).toEqual(CURRENCIES);
  });

  it('re-recording an already-recent currency moves it to the front, not a duplicate', () => {
    recordRecentCurrency('EUR');
    recordRecentCurrency('USD');
    recordRecentCurrency('EUR');
    const ordered = orderedCurrencies();
    expect(ordered.slice(0, 3)).toEqual(['RON', 'EUR', 'USD']);
  });
});

describe('convert', () => {
  it('converts correctly', () => {
    expect(convert(8.5, 5.2318)).toBe(45);
  });

  it('is null for unusable input', () => {
    expect(convert('abc', 5)).toBeNull();
    expect(convert(10, null)).toBeNull();
  });
});

describe('impliedRate', () => {
  it('derives the rate two amounts imply', () => {
    expect(impliedRate(42, 8.5)).toBeCloseTo(4.941, 3);
  });

  it('refuses to divide by zero', () => {
    expect(impliedRate(42, 0)).toBeNull();
  });
});

describe('formatRateNote', () => {
  it('reads as one plain-language line, spelling out RON rather than reusing "L"', () => {
    // Date order is locale-dependent (28 Jul / Jul 28), so assert the parts
    // rather than baking one locale's ordering into the test. Spelling out RON
    // matters: the amount field beside this already ends in "L", so a second
    // "L" here would read as one confused number.
    const note = formatRateNote('eur', 5.2318, '2026-07-28');
    expect(note).toMatch(/^1 EUR = 5\.2318 RON /);
    expect(note).not.toMatch(/ L\b/);
    expect(note).not.toContain('·');
    expect(note).not.toContain('ECB');
    expect(note).toMatch(/28/);
    expect(note).toMatch(/Jul/);
    expect(note.split(String.fromCharCode(10))).toHaveLength(1); // strictly one line
  });

  it('is empty for a zero rate rather than claiming a 0.00 conversion', () => {
    expect(formatRateNote('EUR', 0, '2026-07-28')).toBe('');
  });

  it('says so in plain words when the rate is a stale fallback', () => {
    expect(formatRateNote('EUR', 5.2, '2026-07-28', { stale: true })).toMatch(/rate from/);
  });

  it('is empty without a usable rate', () => {
    expect(formatRateNote('EUR', null)).toBe('');
  });
});

describe('fetchRate', () => {
  it('returns 1 for a currency against itself without calling the network', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchRate('EUR', 'EUR', new Date(2026, 6, 28), { fetchImpl });
    expect(result.rate).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches and returns the rate with the date the ECB actually quoted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-07-28', rates: { RON: 5.2318 } }));
    const result = await fetchRate('EUR', 'RON', new Date(2026, 6, 29), { fetchImpl });
    expect(result).toMatchObject({ rate: 5.2318, date: '2026-07-28', cached: false });
  });

  it('reports the quoted date, not the requested one', async () => {
    // Asking for a Sunday gets the preceding business day back. Showing the
    // requested date would misattribute the number.
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-07-17', rates: { RON: 5.19 } }));
    const result = await fetchRate('EUR', 'RON', '2026-07-19', { fetchImpl });
    expect(result.date).toBe('2026-07-17');
  });

  it('serves a repeat request from cache without hitting the network again', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-07-28', rates: { RON: 5.2318 } }));
    await fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl });
    const second = await fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ rate: 5.2318, cached: true });
  });

  it('uses the dated endpoint for history and `latest` for today', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-01-05', rates: { RON: 4.9 } }));
    await fetchRate('EUR', 'RON', '2026-01-05', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toContain('/2026-01-05?');

    // Local date, not toISOString(): that reports UTC, so after midnight local
    // time the string is yesterday's and the "is this today?" branch flips.
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    fetchImpl.mockClear();
    await fetchRate('USD', 'RON', todayStr, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toContain('/latest?');
  });

  it('returns null rather than throwing when the network fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl })).resolves.toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl })).toBeNull();
  });

  it('returns null when the payload has no usable rate', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-07-28', rates: {} }));
    expect(await fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl })).toBeNull();
  });

  it('never calls the network for an unrated currency', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchRate('BGN', 'RON', '2026-07-28', { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('survives a corrupted cache entry instead of throwing', async () => {
    localStorage.setItem('whereItWent_fx_rates', '{not json');
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ date: '2026-07-28', rates: { RON: 5.2318 } }));
    const result = await fetchRate('EUR', 'RON', '2026-07-28', { fetchImpl });
    expect(result.rate).toBe(5.2318);
  });
});

describe('cacheKey', () => {
  it('is case-insensitive and pair-specific', () => {
    expect(cacheKey('eur', 'ron', '2026-07-28')).toBe('2026-07-28|EUR|RON');
    expect(cacheKey('EUR', 'RON', '2026-07-28')).not.toBe(cacheKey('USD', 'RON', '2026-07-28'));
  });
});

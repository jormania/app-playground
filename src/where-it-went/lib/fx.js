/**
 * Live exchange rates, for recording what a foreign charge really cost.
 *
 * Source: Frankfurter (api.frankfurter.dev), which serves the ECB's daily
 * reference rates, needs no API key, and — verified against a real browser
 * before this was written — sends permissive CORS headers. That matters
 * structurally: `api/*.js` sits at 12/12 against the Vercel Hobby cap, so a
 * server-side proxy for this was never an option. If the host ever stops
 * allowing cross-origin reads, the fallback is a `mode=fx` branch inside the
 * existing `api/notion.js`, not a new function file.
 *
 * The RON amount stays the source of truth for every total. A rate only ever
 * *suggests* it; nothing here silently rewrites a figure you typed.
 */
import { toDateString } from './period';

export const BASE_CURRENCY = 'RON';

const API = 'https://api.frankfurter.dev/v1';
const CACHE_KEY = 'whereItWent_fx_rates';

/**
 * Currencies offered in the picker.
 *
 * This list is *also* the registered option set of the `Original Currency`
 * select in Notion. It has to stay in step: writing an unregistered select
 * option makes Notion reject the entire atomic patch, so an unlisted currency
 * wouldn't just fail to save itself — it would silently drop the amount, notes
 * and everything else in the same write.
 */
export const CURRENCIES = [
  'RON', 'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'HUF', 'CZK',
  'BGN', 'TRY', 'SEK', 'NOK', 'DKK', 'JPY', 'CAD', 'AUD',
];

/**
 * Currencies the ECB actually publishes. BGN is deliberately absent: Bulgaria
 * adopted the euro and the ECB stopped quoting it, so a BGN charge can still be
 * *recorded* — it stays in CURRENCIES — but no rate will be offered for it.
 */
export const RATED_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'HUF', 'CZK',
  'TRY', 'SEK', 'NOK', 'DKK', 'JPY', 'CAD', 'AUD', 'RON',
]);

export function canConvert(currency) {
  return RATED_CURRENCIES.has(String(currency || '').toUpperCase());
}

const RECENT_KEY = 'whereItWent_recent_currencies';
const MAX_RECENT = 5;

function readRecentCurrencies() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(c => CURRENCIES.includes(c)) : [];
  } catch {
    return [];
  }
}

/** Call after saving a foreign-currency transaction, so it floats toward the
 * top of the picker next time. RON is never recorded — it's always first
 * regardless, being the base. */
export function recordRecentCurrency(currency) {
  const code = String(currency || '').toUpperCase();
  if (code === BASE_CURRENCY || !CURRENCIES.includes(code)) return;
  try {
    const next = [code, ...readRecentCurrencies().filter(c => c !== code)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — recency is a convenience, never block on this */
  }
}

/**
 * Currency picker options, reordered so the ones you actually need aren't
 * buried in a flat 16-item alphabet-adjacent list. RON is always first (the
 * base), then `priority` (the account's or trip's own currency for this
 * transaction — usually already selected, but worth surfacing for anyone
 * about to pick something else), then recently-used currencies, then
 * everything else in the registered order. Never drops or reorders the
 * underlying vocabulary — every code in CURRENCIES still appears exactly once.
 */
export function orderedCurrencies(priority) {
  const seen = new Set([BASE_CURRENCY]);
  const ordered = [BASE_CURRENCY];
  const add = (code) => {
    if (!code || seen.has(code) || !CURRENCIES.includes(code)) return;
    seen.add(code);
    ordered.push(code);
  };
  add(String(priority || '').toUpperCase());
  readRecentCurrencies().forEach(add);
  CURRENCIES.forEach(add);
  return ordered;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* private mode / quota — rates are a convenience, never block on this */
  }
}

/** Cache entries are keyed by the date asked for, plus the currency pair. */
export function cacheKey(from, to, dateStr) {
  return `${dateStr}|${String(from).toUpperCase()}|${String(to).toUpperCase()}`;
}

/**
 * How many `to` units one `from` unit buys, on (or just before) `date`.
 *
 * Returns `{ rate, date, cached }`, where `date` is the day the rate is
 * actually *from* — ask for a Sunday and the ECB has no fixing, so the API
 * answers with the preceding business day. Showing the requested date instead
 * would quietly misattribute the number.
 *
 * Never throws: a failure returns null and the UI simply doesn't offer a
 * conversion. A missing rate must not be able to block recording a transaction.
 */
export async function fetchRate(from, to, date = new Date(), deps = {}) {
  const { fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = deps;
  const src = String(from || '').toUpperCase();
  const dst = String(to || '').toUpperCase();

  if (!src || !dst) return null;
  if (src === dst) return { rate: 1, date: toDateString(date), cached: true };
  if (!canConvert(src) || !canConvert(dst)) return null;
  if (!fetchImpl) return null;

  const requested = typeof date === 'string' ? date.slice(0, 10) : toDateString(date);
  const key = cacheKey(src, dst, requested);

  const cache = readCache();
  if (cache[key]) return { ...cache[key], cached: true };

  // Today's rate may not be published yet, so `latest` is the right endpoint
  // for today and a dated one for anything historical.
  const today = toDateString(new Date());
  const path = requested >= today ? 'latest' : requested;

  try {
    const response = await fetchImpl(`${API}/${path}?base=${src}&symbols=${dst}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const rate = payload?.rates?.[dst];
    if (!Number.isFinite(rate)) return null;

    const entry = { rate, date: payload.date || requested };
    cache[key] = entry;
    writeCache(cache);
    return { ...entry, cached: false };
  } catch {
    return null;
  }
}

/** Convert an amount at a rate, rounded to cents. */
export function convert(amount, rate) {
  // Null/'' coerce to 0 through Number(), which is finite — without the
  // explicit guard a missing rate yields a convincing 0.00 instead of "no
  // conversion available", and 0.00 looks like a real answer.
  if (amount == null || amount === '' || rate == null || rate === '') return null;
  const value = Number(amount);
  const r = Number(rate);
  if (!Number.isFinite(value) || !Number.isFinite(r) || r <= 0) return null;
  return Math.round(value * r * 100) / 100;
}

/**
 * The rate two recorded amounts imply.
 *
 * Used when the RON figure is edited by hand: rather than overwriting what was
 * typed, the app recomputes what rate that implies and shows it, so an unusual
 * card fee is visible rather than silently averaged away.
 */
export function impliedRate(amountBase, amountForeign) {
  const base = Number(amountBase);
  const foreign = Number(amountForeign);
  if (!Number.isFinite(base) || !Number.isFinite(foreign) || foreign === 0) return null;
  return base / foreign;
}

/**
 * "1 EUR = 5.24 RON (29 Jul)" — the plain-language rate line under the amount.
 *
 * Spells out RON rather than reusing the "L" suffix the amount field already
 * wears: two different quantities both ending in "L" on the same line read as
 * one confused number. Words instead of "·" separators and an unexplained
 * "ECB" abbreviation, so it parses at a glance rather than needing decoding.
 */
export function formatRateNote(currency, rate, rateDate, { stale = false } = {}) {
  // `Number(null)` is 0, which is finite — without the explicit null/zero guard
  // a missing rate renders as a confident-looking "1 EUR = 0.00 RON".
  if (rate == null || !Number.isFinite(Number(rate)) || Number(rate) <= 0) return '';
  const pretty = Number(rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const cur = String(currency).toUpperCase();

  const d = rateDate ? new Date(`${String(rateDate).slice(0, 10)}T00:00:00`) : null;
  if (!d || Number.isNaN(d.getTime())) return `1 ${cur} = ${pretty} RON`;

  const when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return stale ? `1 ${cur} = ${pretty} RON (rate from ${when})` : `1 ${cur} = ${pretty} RON (${when})`;
}

/** Wipe the cached rates (exposed for tests and for a manual refresh). */
export function clearRateCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

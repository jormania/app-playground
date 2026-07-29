import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { billsToNotify, daysUntilDue } from './reminders';

/**
 * The service worker is a classic script and cannot import the ES module the
 * page uses, so `billsToNotify` exists twice: once in lib/reminders.js and once
 * inline in public/where-it-went-sw.js. NOTIFICATIONS.md calls this out as the
 * one place duplication reliably creeps back.
 *
 * Rather than trust a comment to keep them in step, this lifts the worker's
 * copy straight out of the file and runs both against the same cases. If either
 * side is edited alone, this fails.
 */
const swSource = readFileSync(
  resolve(process.cwd(), 'public/where-it-went-sw.js'),
  'utf8',
);

function extractFunction(name) {
  const start = swSource.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in the service worker`);
  // Walk braces from the first one so nested blocks don't end it early.
  let depth = 0;
  let i = swSource.indexOf('{', start);
  for (; i < swSource.length; i++) {
    if (swSource[i] === '{') depth++;
    else if (swSource[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return swSource.slice(start, i + 1) + `\nreturn ${name};`;
}

const swDaysUntilDue = new Function(extractFunction('daysUntilDue'))();
const swBillsToNotify = new Function(
  `${extractFunction('daysUntilDue').replace('\nreturn daysUntilDue;', '')}\n${extractFunction('billsToNotify')}`,
)();

const now = new Date(2026, 6, 15); // 15 Jul 2026

const state = (over = {}) => ({
  enabled: true,
  leadDays: 5,
  bills: [
    { id: 's1:2026-07-18', name: 'Netflix', amount: 60, type: 'Expense', dueDate: '2026-07-18' },
    { id: 's2:2026-07-28', name: 'Spotify', amount: 25, type: 'Expense', dueDate: '2026-07-28' },
    { id: 's3:2026-07-10', name: 'Gym', amount: 150, type: 'Expense', dueDate: '2026-07-10' },
  ],
  ...over,
});

describe('service worker mirrors lib/reminders.js', () => {
  it('has the notification half wired up at all', () => {
    expect(swSource).toContain("importScripts('/shared-notify-idb.js')");
    expect(swSource).toContain("addEventListener('periodicsync'");
    expect(swSource).toContain("addEventListener('notificationclick'");
  });

  it('still keeps the caching half it had before reminders were added', () => {
    // Regression guard: the notification work must not have eaten the worker's
    // original job.
    expect(swSource).toContain("addEventListener('fetch'");
    expect(swSource).toContain('whereitwent-cache-v1');
  });

  it('reads the same IndexedDB store the page writes', () => {
    expect(swSource).toContain("'wiw-reminders'");
    expect(swSource).toContain("'wiw-bill-reminders'");
  });

  const dateCases = ['2026-07-15', '2026-07-16', '2026-07-18', '2026-07-10', '2027-01-01', 'nonsense', ''];
  it.each(dateCases)('daysUntilDue agrees for %s', (value) => {
    expect(swDaysUntilDue(value, now)).toEqual(daysUntilDue(value, now));
  });

  const cases = [
    ['inside the lead time', state(), []],
    ['with one already sent', state(), ['s1:2026-07-18']],
    ['disabled', state({ enabled: false }), []],
    ['wider lead time', state({ leadDays: 20 }), []],
    ['no bills', state({ bills: [] }), []],
    ['missing leadDays falls back', state({ leadDays: undefined }), []],
  ];

  it.each(cases)('billsToNotify agrees %s', (_label, snapshot, sent) => {
    const mine = billsToNotify(snapshot, sent, now).map(b => b.id);
    const theirs = swBillsToNotify(snapshot, sent, now).map(b => b.id);
    expect(theirs).toEqual(mine);
  });

  it('both agree that a past-due bill is not a reminder', () => {
    const snapshot = state();
    expect(swBillsToNotify(snapshot, [], now).map(b => b.id)).not.toContain('s3:2026-07-10');
    expect(billsToNotify(snapshot, [], now).map(b => b.id)).not.toContain('s3:2026-07-10');
  });
});

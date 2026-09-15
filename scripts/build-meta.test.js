import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { countServerlessFunctions, parseBacklogCounts } from './build-meta.js';

const REPO = resolve(__dirname, '..');

describe('countServerlessFunctions', () => {
  const fixture = (names) => {
    const dir = mkdtempSync(join(tmpdir(), 'api-'));
    for (const n of names) writeFileSync(join(dir, n), '');
    return dir;
  };

  it('counts top-level .js handlers', () => {
    expect(countServerlessFunctions(fixture(['a.js', 'b.js', 'c.js']))).toBe(3);
  });

  it('ignores api/_* files, which Vercel does not bill', () => {
    expect(countServerlessFunctions(fixture(['a.js', '_shared.js', '_lib.js']))).toBe(1);
  });

  it('ignores subdirectories', () => {
    const dir = fixture(['a.js']);
    mkdirSync(join(dir, '_lib'));
    writeFileSync(join(dir, '_lib', 'helper.js'), '');
    expect(countServerlessFunctions(dir)).toBe(1);
  });

  it('counts a .test.js sitting directly in api/ — Vercel does', () => {
    expect(countServerlessFunctions(fixture(['a.js', 'a.test.js']))).toBe(2);
  });

  it('ignores non-.js files', () => {
    expect(countServerlessFunctions(fixture(['a.js', 'notes.md', 'b.ts']))).toBe(1);
  });

  it('keeps this repo at or under the Vercel Hobby cap of 12', () => {
    // Not a gauge test — a guardrail. A thirteenth top-level api/*.js does not
    // degrade the footer, it fails the deploy. Fail here instead, in CI.
    expect(countServerlessFunctions(resolve(REPO, 'api'))).toBeLessThanOrEqual(12);
  });
});

describe('parseBacklogCounts', () => {
  it('counts open and proposed items from headers', () => {
    const md = [
      '## R-001 — one · `refactor` · `open`',
      '## R-002 — two · `modernise` · `open`',
      '## R-003 — three · `refactor` · `done 2026-09-14`',
      '## P-001 — four · `visual` · `proposed`',
    ].join('\n\n');
    expect(parseBacklogCounts(md)).toEqual({ open: 2, proposed: 1 });
  });

  it('ignores prose and the class table above the list', () => {
    const md = [
      '**States:** `open` · `claimed` · `done` · `blocked` · `dropped`',
      '| `refactor` | Behaviour-preserving | yes |',
      'Anything under **`## Proposed`** is `proposed` until moved up.',
      '## R-001 — real item · `refactor` · `open`',
    ].join('\n\n');
    expect(parseBacklogCounts(md)).toEqual({ open: 1, proposed: 0 });
  });

  it('does not count deeper headings', () => {
    expect(parseBacklogCounts('### R-001 — nested · `refactor` · `open`')).toEqual({ open: 0, proposed: 0 });
  });

  it('returns zeroes for an empty backlog', () => {
    expect(parseBacklogCounts('# Backlog\n\n_(nothing right now.)_')).toEqual({ open: 0, proposed: 0 });
  });

  it('parses the real REFACTOR_BACKLOG.md without throwing', () => {
    const counts = parseBacklogCounts(readFileSync(resolve(REPO, 'REFACTOR_BACKLOG.md'), 'utf8'));
    expect(counts.open).toBeGreaterThanOrEqual(0);
    expect(counts.proposed).toBeGreaterThanOrEqual(0);
  });
});

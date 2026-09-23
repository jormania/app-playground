import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { cleanCommitSubject, countServerlessFunctions, directorySizeBytes, parseBacklogCounts, withBuildSizeMeta } from './build-meta.js';

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

describe('directorySizeBytes', () => {
  const tree = () => mkdtempSync(join(tmpdir(), 'dist-'));

  it('sums the files in one directory', () => {
    const dir = tree();
    writeFileSync(join(dir, 'a.js'), 'x'.repeat(100));
    writeFileSync(join(dir, 'b.css'), 'y'.repeat(50));
    expect(directorySizeBytes(dir)).toBe(150);
  });

  it('recurses — dist/assets is where the weight actually is', () => {
    const dir = tree();
    writeFileSync(join(dir, 'index.html'), 'x'.repeat(10));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'y'.repeat(1000));
    mkdirSync(join(dir, 'assets', 'nested'));
    writeFileSync(join(dir, 'assets', 'nested', 'font.woff2'), 'z'.repeat(2000));
    expect(directorySizeBytes(dir)).toBe(3010);
  });

  it('counts every extension — the incidents were a .woff2 and a .wasm', () => {
    const dir = tree();
    writeFileSync(join(dir, 'ort.wasm'), 'w'.repeat(500));
    writeFileSync(join(dir, 'jp.woff2'), 'f'.repeat(700));
    expect(directorySizeBytes(dir)).toBe(1200);
  });

  it('is zero for an empty directory', () => {
    expect(directorySizeBytes(tree())).toBe(0);
  });

  it('measures the repo root without throwing', () => {
    expect(directorySizeBytes(resolve(REPO, 'scripts'))).toBeGreaterThan(0);
  });
});

describe('withBuildSizeMeta', () => {
  const page = (extra = '') =>
    `<!doctype html>\n<html>\n<head>\n  <meta name="deploy-date" content="2026-09-16T09:52:49.942Z">\n  <meta name="build-commit" content="345d8dd">${extra}\n</head>\n<body></body>\n</html>`;

  it('stamps the size after the deploy-date tag', () => {
    const out = withBuildSizeMeta(page(), 9353208);
    expect(out).toContain('<meta name="build-size" content="9353208">');
    expect(out.indexOf('build-size')).toBeGreaterThan(out.indexOf('deploy-date'));
    expect(out.indexOf('build-size')).toBeLessThan(out.indexOf('build-commit'));
  });

  it('rounds to whole bytes — the attribute is read with Number()', () => {
    expect(withBuildSizeMeta(page(), 1024.6)).toContain('content="1025"');
  });

  it('leaves a page that never went through buildMetaPlugin alone', () => {
    // public/*.html is copied verbatim and carries no build meta at all.
    const static_ = '<!doctype html>\n<html><head><title>Static</title></head></html>';
    expect(withBuildSizeMeta(static_, 500)).toBe(static_);
  });

  it('is idempotent — a second pass never stamps on top of the first', () => {
    const once = withBuildSizeMeta(page(), 100);
    expect(withBuildSizeMeta(once, 999)).toBe(once);
  });

  it('leaves the rest of the document untouched', () => {
    const out = withBuildSizeMeta(page(), 1);
    expect(out.replace(/\n\s*<meta name="build-size"[^>]*>/, '')).toBe(page());
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

  it('counts an open item that carries a progress note after its state', () => {
    // The form that broke the footer on 2026-09-23: a note after the state token
    // dropped the item from the count, and four of nine open items went missing.
    const md = [
      '## R-008 — deps · `modernise` · `open` — jsdom done, five families to go',
      '## R-024 — branches · `refactor` · `open` — **not agent-executable, see below**',
      '## R-026 — theme · `refactor` · `open`',
    ].join('\n');
    expect(parseBacklogCounts(md)).toEqual({ open: 3, proposed: 0 });
  });

  it('does not mistake the word open elsewhere in a header for the state', () => {
    // Loosening the anchor must not start counting a title that mentions `open`,
    // or a done item whose note happens to say it.
    const md = [
      '## R-090 — the `open` door problem · `refactor` · `done 2026-09-23`',
      '## R-091 — something · `modernise` · `done 2026-09-23` — was `open` for a week',
      '## R-092 — `open`ing hours · `visual` · `blocked`',
    ].join('\n');
    expect(parseBacklogCounts(md)).toEqual({ open: 0, proposed: 0 });
  });

  it('agrees with a plain split on the real backlog', () => {
    // A second, independent reading of the same file — split on the separator and
    // look at the state segment — so the regex cannot drift away from what the
    // headers actually say without this failing.
    const md = readFileSync(resolve(REPO, 'REFACTOR_BACKLOG.md'), 'utf8');
    const stateOf = (line) => (line.split(' · ')[2] || '').trim();
    const headers = md.split('\n').filter((l) => l.startsWith('## ') && l.split(' · ').length >= 3);
    const expected = {
      open: headers.filter((l) => /^`open`(\s|$)/.test(stateOf(l))).length,
      proposed: headers.filter((l) => /^`proposed`(\s|$)/.test(stateOf(l))).length,
    };
    expect(parseBacklogCounts(md)).toEqual(expected);
  });

  it('parses the real REFACTOR_BACKLOG.md without throwing', () => {
    const counts = parseBacklogCounts(readFileSync(resolve(REPO, 'REFACTOR_BACKLOG.md'), 'utf8'));
    expect(counts.open).toBeGreaterThanOrEqual(0);
    expect(counts.proposed).toBeGreaterThanOrEqual(0);
  });
});

describe('cleanCommitSubject', () => {
  it('leaves a subject within budget untouched', () => {
    expect(cleanCommitSubject('Fix the thing', 60)).toBe('Fix the thing');
  });

  it('marks elision rather than stopping mid-word', () => {
    const out = cleanCommitSubject('Route to the footer docs from CLAUDE.md instead of restating them', 60);
    expect(out).toBe('Route to the footer docs from CLAUDE.md instead of\u2026');
    expect(out.endsWith('\u2026')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(60);
  });

  it('never exceeds the budget, ellipsis included', () => {
    for (const n of [12, 20, 40, 60]) {
      expect(cleanCommitSubject('a'.repeat(200), n).length).toBeLessThanOrEqual(n);
      expect(cleanCommitSubject('word '.repeat(80), n).length).toBeLessThanOrEqual(n);
    }
  });

  it('falls back to a hard cut when one token eats the budget', () => {
    // No usable word boundary — better a hard cut than three characters.
    expect(cleanCommitSubject('Bump ' + 'x'.repeat(80), 20)).toBe('Bump ' + 'x'.repeat(14) + '\u2026');
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    // The word boundary lands straight after the comma; the comma should not
    // survive to sit against the ellipsis.
    expect(cleanCommitSubject('Fix the parser, then everything else', 18)).toBe('Fix the parser\u2026');
    // Punctuation away from the cut is ordinary text and stays.
    expect(cleanCommitSubject('Fix parsing, then the rest of it all', 20)).toBe('Fix parsing, then\u2026');
  });

  it('strips characters that would break out of an attribute value', () => {
    expect(cleanCommitSubject('Add <script> and "quotes"', 60)).toBe('Add script and quotes');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanCommitSubject('   padded   ', 60)).toBe('padded');
  });
});

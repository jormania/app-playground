/**
 * Every `var(--…)` referenced under src/where-it-went must resolve against
 * `src/ds/tokens.css` or this app's own `index.css`. This exact class of bug
 * shipped twice — `--color-brass`/`--color-purple`/`--color-primary`/
 * `--radius-full`/`--text-md` in the 2026-07-30 go-live audit, then
 * `--color-primary`/`--color-on-primary`/`--color-primary-muted`/
 * `--weight-normal` again later — and each time it silently dropped a colour,
 * radius or font-size rather than throwing, so nothing but a visual read
 * caught it. A static scan can't see every rendered pixel, but it can catch
 * an undefined custom property before it ships.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, exts, out);
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function definedTokens(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens = new Set();
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) tokens.add(m[1]);
  return tokens;
}

function usedTokens(files) {
  const usages = new Map(); // token -> Set(file)
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
      const token = m[1];
      if (!usages.has(token)) usages.set(token, new Set());
      usages.get(token).add(path.relative(REPO_ROOT, file));
    }
  }
  return usages;
}

describe('WhereItWent CSS custom properties resolve', () => {
  it('every var(--…) used under src/where-it-went is defined somewhere', () => {
    const dsTokens = definedTokens(path.join(REPO_ROOT, 'src', 'ds', 'tokens.css'));
    const appTokens = definedTokens(path.join(REPO_ROOT, 'src', 'where-it-went', 'index.css'));
    const defined = new Set([...dsTokens, ...appTokens]);

    const srcDir = path.join(REPO_ROOT, 'src', 'where-it-went');
    const files = walk(srcDir, ['.jsx', '.js', '.css']).filter(f => !f.includes('.test.'));
    const used = usedTokens(files);

    const missing = [];
    for (const [token, inFiles] of used) {
      if (!defined.has(token)) missing.push(`${token} (used in ${[...inFiles].join(', ')})`);
    }

    expect(missing).toEqual([]);
  });
});

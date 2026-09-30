import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHeader, topmostEligible, chooseModel, OPUS, SONNET } from './pick-model.mjs';

const REPO = resolve(__dirname, '..');

const backlog = (...headers) => ['# Refactor backlog', '', ...headers, '', '## Proposed', ''].join('\n');

describe('topmostEligible', () => {
  it('takes the first open item in file order', () => {
    const md = backlog(
      '## R-001 — a · `refactor` · `done 2026-09-01`',
      '## R-002 — b · `modernise` · `open`',
      '## R-003 — c · `visual` · `open`',
    );
    expect(topmostEligible(md)).toEqual({ id: 'R-002', cls: 'modernise', state: 'open' });
  });

  it('passes over blocked, dropped and not-agent-executable items', () => {
    const md = backlog(
      '## R-001 — a · `modernise` · `blocked`',
      '## R-002 — b · `modernise` · `dropped`',
      '## R-003 — c · `refactor` · `open` — **not agent-executable, see below**',
      '## R-004 — d · `visual` · `open`',
    );
    expect(topmostEligible(md).id).toBe('R-004');
  });

  it('passes over an item an open PR has claimed', () => {
    const md = backlog('## P-001c — a · `visual` · `open`', '## R-008 — b · `modernise` · `open`');
    expect(topmostEligible(md, new Set(['P-001c'])).id).toBe('R-008');
  });

  it('still counts an open item that carries a progress note', () => {
    const md = backlog('## R-008 — deps · `modernise` · `open` — jsdom done, five to go');
    expect(topmostEligible(md).id).toBe('R-008');
  });

  it('never reaches into Proposed', () => {
    const md = ['## R-001 — a · `refactor` · `done`', '## Proposed', '## R-099 — x · `modernise` · `open`'].join('\n');
    expect(topmostEligible(md)).toBeNull();
  });

  it('is not thrown by a middle dot inside a title', () => {
    const md = backlog('## R-050 — one · two · three · `visual` · `open`');
    expect(topmostEligible(md)).toEqual({ id: 'R-050', cls: 'visual', state: 'open' });
  });

  it('reads the real backlog to an item with a known class', () => {
    const item = topmostEligible(readFileSync(resolve(REPO, 'REFACTOR_BACKLOG.md'), 'utf8'));
    expect(item).not.toBeNull();
    expect(['refactor', 'modernise', 'qol', 'visual']).toContain(item.cls);
  });
});

describe('parseHeader', () => {
  it('ignores deeper headings and prose', () => {
    expect(parseHeader('### R-001 — a · `refactor` · `open`')).toBeNull();
    expect(parseHeader('Classes: `refactor` · `open`')).toBeNull();
  });
});

describe('chooseModel', () => {
  it('puts a modernise item on Sonnet and names it in the note', () => {
    const { model, note } = chooseModel({ id: 'R-029', cls: 'modernise' }, 'Wednesday');
    expect(model).toBe(SONNET);
    expect(note).toContain('R-029');
    expect(note).toMatch(/do not go on to the next item/);
  });

  it('keeps every other class on Opus', () => {
    for (const cls of ['refactor', 'visual', 'qol']) {
      expect(chooseModel({ id: 'X', cls }, 'Tuesday')).toEqual({ model: OPUS, note: '' });
    }
  });

  it('keeps Friday on Opus even when a modernise item is on top', () => {
    // Friday is discovery whatever is queued; reading for what's missing is not
    // a modernise job.
    expect(chooseModel({ id: 'R-029', cls: 'modernise' }, 'Friday').model).toBe(OPUS);
  });

  it('keeps an empty queue on Opus — the agent falls back to discovery', () => {
    expect(chooseModel(null, 'Monday').model).toBe(OPUS);
  });
});

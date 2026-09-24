// @vitest-environment happy-dom
//
// The empty-state float (`flairEmpty`, on by default) is animated by CSS and
// hooked by a class in JSX, so nothing in either file fails when the two drift
// apart — which is exactly what happened: the rule matched a descendant `<svg>`
// and a literal `width="48"` attribute, the empty states hold emoji, and the
// animation was inert on every screen from the day it was written (R-022).
//
// These tests pin the join. The render cases prove the markup carries the hook;
// the stylesheet cases prove the rule still selects that hook and nothing
// shape-based.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import TransactionsList from './components/TransactionsList';
import Dashboard from './components/Dashboard';
import InsightsView from './components/InsightsView';

vi.mock('chart.js/auto', () => ({
  default: class {
    destroy() {}
  }
}));

vi.mock('./lib/analytics', () => ({
  generateDeepInsights: (data) => (data.transactions?.length ? {} : null)
}));

afterEach(() => {
  cleanup();
});

// Repo-relative, as css-tokens.test.js does it — under happy-dom `import.meta.url`
// is an http: URL and `fileURLToPath` refuses it.
const css = readFileSync('src/where-it-went/index.css', 'utf8');
// Comments sit between rules and would otherwise be read as part of the next
// selector list — and these particular rules are heavily commented.
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The icon element sitting immediately above an empty state's heading. */
function iconAbove(headingText) {
  const heading = screen.getByText(headingText);
  return heading.previousElementSibling;
}

describe('empty-state float hook', () => {
  it('is on the icon of the "Nothing here" transactions empty state', () => {
    render(
      <TransactionsList
        data={{ categories: [], accounts: [], transactions: [] }}
        client={{}}
        onDataChange={vi.fn()}
        period="all_time"
      />
    );
    expect(iconAbove('Nothing here').className).toContain('empty-state-icon');
  });

  it('is on the icon of the "Nothing to chart" dashboard empty state', () => {
    render(<Dashboard data={{ categories: [], transactions: [] }} />);
    expect(iconAbove('Nothing to chart').className).toContain('empty-state-icon');
  });

  it('is on the icon of the "Nothing to analyse yet" insights empty state', () => {
    render(<InsightsView data={{ transactions: [] }} />);
    expect(iconAbove('Nothing to analyse yet').className).toContain('empty-state-icon');
  });

  // App's load-error state is the fourth, and mounting App to reach it would
  // mean standing up a failing Notion client. Its hook is checked as source.
  it('is on the icon of App.jsx’s load-error state', () => {
    const app = readFileSync('src/where-it-went/App.jsx', 'utf8');
    expect(app).toMatch(/className="empty-state-icon"[^>]*>⚠/);
  });
});

describe('the float rule in index.css', () => {
  /** Every selector list that declares the float-icon animation. */
  const selectorsFor = (source) =>
    [...source.matchAll(/([^{}]+)\{[^{}]*animation:\s*float-icon[^{}]*\}/g)].map((m) =>
      m[1].split(',').map((s) => s.trim()).filter(Boolean)
    );

  it('hangs off the class hook and nothing else', () => {
    expect(selectorsFor(cssRules)).toEqual([['.flair-empty .empty-state-icon']]);
  });

  it('selects no markup shape — attributes and descendant svg are what went stale', () => {
    const [selectors] = selectorsFor(cssRules);
    for (const selector of selectors) {
      expect(selector).not.toMatch(/\[/);
      expect(selector).not.toMatch(/\bsvg\b/);
    }
  });

  it('is switched off under prefers-reduced-motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/\.flair-empty \.empty-state-icon \{\s*animation: none !important;/);
  });
});

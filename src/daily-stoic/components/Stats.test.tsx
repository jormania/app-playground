// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Stats from './Stats';
import { ReflectionRecord } from '../services/NotionService';
import { installMemoryStorage } from '../test-utils/memoryStorage';

installMemoryStorage();

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const CYCLE_START = '2026-06-01';

function makeReflection(overrides: Partial<ReflectionRecord> & { date: string; quoteId: number }): ReflectionRecord {
  return {
    text: '',
    fateInput: '',
    acceptanceTags: [],
    favorite: false,
    mood: '',
    morningIntentions: '',
    passions: [],
    createdTime: '',
    dichotomy: '',
    virtue: '',
    ...overrides,
  };
}

const reflections: ReflectionRecord[] = [
  makeReflection({ date: '2026-06-01', quoteId: 1, mood: 'Great', morningIntentions: 'Anticipating friction.', favorite: true, text: 'a b c' }),
  makeReflection({ date: '2026-06-05', quoteId: 5, mood: 'Good', text: 'd e' }),
];

// Statless tiles render as `<div><span>Label</span><span>Value</span></div>` —
// scope the query to that tile so a coincidental "0" elsewhere on the page
// (e.g. an unrelated virtue-week row with zero favorites) can't collide.
function tileValue(label: string): string {
  const tile = screen.getByText(label).closest('div');
  if (!tile) throw new Error(`No tile found for label "${label}"`);
  const value = tile.querySelector('span:last-child');
  return value?.textContent ?? '';
}

describe('Stats', () => {
  it('shows a loading message instead of the content while loading', () => {
    render(<Stats streak={0} today={10} cycleStartDate={CYCLE_START} reflections={[]} loading={true} onClose={() => {}} />);
    expect(screen.getByText('Loading your full history…')).toBeTruthy();
    expect(screen.queryByText('Cycles Completed')).toBeNull();
  });

  it('reports all-time tallies and period totals for the default Cycle filter', () => {
    render(
      <Stats streak={2} today={10} cycleStartDate={CYCLE_START} reflections={reflections} loading={false} onClose={() => {}} />
    );

    expect(tileValue('Cycles Completed')).toBe('0'); // no cycle completed yet at day 10
    expect(tileValue('Favorited Quotes')).toBe('1');

    // Cycle filter (default): day 1 through day 10 -> 10 elapsed days, both entries included.
    expect(screen.getByText('2 / 10')).toBeTruthy();
    // 1 of the 2 entries has morningIntentions set.
    expect(screen.getByText('50% (1/2)')).toBeTruthy();
  });

  it('recomputes period totals when the filter changes to All', async () => {
    const user = userEvent.setup();
    render(
      <Stats streak={0} today={10} cycleStartDate={CYCLE_START} reflections={reflections} loading={false} onClose={() => {}} />
    );

    await user.click(screen.getByText('All'));
    // "All" is unfiltered: denominator becomes `today` (10), same 2 logged entries.
    expect(screen.getByText('2 / 10')).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Stats streak={0} today={10} cycleStartDate={CYCLE_START} reflections={reflections} loading={false} onClose={onClose} />
    );
    await user.click(screen.getByTitle('Close Stats'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

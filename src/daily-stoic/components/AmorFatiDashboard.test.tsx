// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AmorFatiDashboard from './AmorFatiDashboard';
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

describe('AmorFatiDashboard', () => {
  it('shows a loading message instead of content while loading', () => {
    render(
      <AmorFatiDashboard reflections={[]} loading={true} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );
    expect(screen.getByText('Loading your full history…')).toBeTruthy();
  });

  it('shows the empty state with no reframed reflections, and Demo Mode reveals sample data', async () => {
    const user = userEvent.setup();
    render(
      <AmorFatiDashboard reflections={[]} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );
    expect(screen.getByText('No Obstacles Reframed')).toBeTruthy();

    await user.click(screen.getByText('See Demo Analytics'));
    expect(screen.getByText('68%')).toBeTruthy();
  });

  it('computes reframe rate and dominant obstacle tag from real reflections', () => {
    const reflections: ReflectionRecord[] = [
      makeReflection({ date: '2026-06-01', quoteId: 1, fateInput: 'Missed my flight.', acceptanceTags: ['Situation'] }),
      makeReflection({ date: '2026-06-05', quoteId: 5, fateInput: 'Rude coworker.', acceptanceTags: ['Situation', 'Outcome'] }),
    ];
    render(
      <AmorFatiDashboard reflections={reflections} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );

    expect(screen.getByText('100%')).toBeTruthy(); // both entries within the Cycle period were reframed
    expect(screen.getAllByText('Situation / Events').length).toBeGreaterThan(0); // dominant tag
  });

  it('excludes reflections outside the selected period from the reframe rate', () => {
    // today=10 -> Cycle filter covers day 1 through day 10 only.
    const reflections: ReflectionRecord[] = [
      makeReflection({ date: '2026-06-01', quoteId: 1, fateInput: 'In range.', acceptanceTags: ['Situation'] }),
      makeReflection({ date: '2026-05-01', quoteId: -30, fateInput: 'Out of range.', acceptanceTags: ['Time'] }),
    ];
    render(
      <AmorFatiDashboard reflections={reflections} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );

    // Only the in-range entry counts toward totalLogs/reframedLogs for the rate.
    const summary = screen.getByText(/out of your/);
    const strongValues = Array.from(summary.querySelectorAll('strong')).map((el) => el.textContent);
    expect(strongValues).toEqual(['1', '1']);
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AmorFatiDashboard reflections={[]} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={onClose} />
    );
    await user.click(screen.getByTitle('Close Amor Fati'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PassionsAnalytics from './PassionsAnalytics';
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

describe('PassionsAnalytics', () => {
  it('shows a loading message instead of content while loading', () => {
    render(
      <PassionsAnalytics reflections={[]} loading={true} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );
    expect(screen.getByText('Loading your full history…')).toBeTruthy();
  });

  it('shows the empty state naming the current period, and Start Journaling closes the dashboard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PassionsAnalytics reflections={[]} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={onClose} />
    );
    expect(screen.getByText(/The Citadel of Mind is Clear/)).toBeTruthy();
    expect(screen.getByText(/in the past cycle\./)).toBeTruthy(); // default period is "Cycle"

    await user.click(screen.getByText('Start Journaling'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Demo Mode reveals the sample dominant passion and temporal pattern', async () => {
    const user = userEvent.setup();
    render(
      <PassionsAnalytics reflections={[]} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );
    await user.click(screen.getByText('See Demo Analytics'));
    expect(screen.getByText('Friction Point: Impatience & Anger')).toBeTruthy();
    expect(screen.getByText('Monday mornings', { exact: false })).toBeTruthy();
  });

  it('computes the dominant passion and log counts from real reflections within the period', () => {
    const reflections: ReflectionRecord[] = [
      makeReflection({ date: '2026-06-01', quoteId: 1, passions: ['impatience'] }),
      makeReflection({ date: '2026-06-03', quoteId: 3, passions: ['impatience', 'anxiety'] }),
      makeReflection({ date: '2026-06-05', quoteId: 5, passions: [] }),
    ];
    render(
      <PassionsAnalytics reflections={reflections} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={() => {}} />
    );

    expect(screen.getByText('Friction Point: Impatience & Anger')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // Total Logs
    expect(screen.getByText('2 (67%)')).toBeTruthy(); // Logs with Passions
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PassionsAnalytics reflections={[]} loading={false} today={10} cycleStartDate={CYCLE_START} onClose={onClose} />
    );
    await user.click(screen.getByTitle('Close Passions'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

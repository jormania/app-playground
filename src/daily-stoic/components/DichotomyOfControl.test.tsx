// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DichotomyOfControl } from './DichotomyOfControl';
import { installMemoryStorage } from '../test-utils/memoryStorage';

installMemoryStorage();

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const CYCLE_START = '2026-06-01';

describe('DichotomyOfControl', () => {
  it('shows a loading message instead of content while loading', () => {
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={true} worries={[]} />);
    expect(screen.getByText('Loading your full history…')).toBeTruthy();
  });

  it('shows the empty state when there are no worries, and Demo Mode reveals sample data', async () => {
    const user = userEvent.setup();
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={false} worries={[]} />);
    expect(screen.getByText('No Worries Logged')).toBeTruthy();

    await user.click(screen.getByText('See Demo Analytics'));
    expect(screen.getByText('Up to Me (60%)')).toBeTruthy();
    expect(screen.getByText('Not Up to Me (40%)')).toBeTruthy();
  });

  it('computes the control ratio and resolution rate from real worries within the period', () => {
    const worries = [
      { id: 'w1', text: 'Prepare well for the talk', category: 'up-to-me' as const, isResolved: true, createdAt: '2026-06-01' },
      { id: 'w2', text: 'Respond calmly to feedback', category: 'up-to-me' as const, isResolved: false, createdAt: '2026-06-02' },
      { id: 'w3', text: 'Whether it rains tomorrow', category: 'not-up-to-me' as const, isResolved: false, createdAt: '2026-06-03' },
    ];
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={false} worries={worries} />);

    expect(screen.getByText('Up to Me (67%)')).toBeTruthy();
    expect(screen.getByText('Not Up to Me (33%)')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy(); // resolution rate: 1 of 2 up-to-me resolved
  });

  it('excludes worries created outside the selected period', () => {
    const worries = [
      { id: 'w1', text: 'In range', category: 'up-to-me' as const, isResolved: true, createdAt: '2026-06-01' },
      { id: 'w2', text: 'Out of range', category: 'up-to-me' as const, isResolved: false, createdAt: '2026-05-01' },
    ];
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={false} worries={worries} />);

    // Only the in-range worry counts, so resolution rate is 100%, not 50%.
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('falls back to reading worries from localStorage when no worries prop is given', () => {
    localStorage.setItem(
      'daily-stoic:dichotomy',
      JSON.stringify([{ id: 'w1', text: 'Offline worry', category: 'up-to-me', isResolved: false, createdAt: '2026-06-01' }])
    );
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={false} />);
    expect(screen.getByText('Up to Me (100%)')).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DichotomyOfControl today={10} cycleStartDate={CYCLE_START} loading={false} worries={[]} onClose={onClose} />);
    await user.click(screen.getByTitle('Close Dashboard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

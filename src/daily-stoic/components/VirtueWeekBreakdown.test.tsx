// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import VirtueWeekBreakdown from './VirtueWeekBreakdown';
import { VirtueWeekStats } from '../utils/stats';

afterEach(cleanup);

const stats: VirtueWeekStats[] = [
  { virtue: 'Wisdom', week: 1, totalDays: 14, loggedDays: 10, consistencyRate: 71, avgMood: 3.5, favoritesCount: 2 },
  { virtue: 'Courage', week: 2, totalDays: 7, loggedDays: 0, consistencyRate: 0, avgMood: null, favoritesCount: 0 },
  { virtue: 'Justice', week: 3, totalDays: 7, loggedDays: 7, consistencyRate: 100, avgMood: 5, favoritesCount: 1 },
  { virtue: 'Temperance', week: 4, totalDays: 0, loggedDays: 0, consistencyRate: 0, avgMood: null, favoritesCount: 0 },
];

describe('VirtueWeekBreakdown', () => {
  it('renders all four virtues with their consistency, mood, and favorites', () => {
    render(<VirtueWeekBreakdown stats={stats} />);

    expect(screen.getByText('Wisdom')).toBeTruthy();
    expect(screen.getByText('Courage')).toBeTruthy();
    expect(screen.getByText('Justice')).toBeTruthy();
    expect(screen.getByText('Temperance')).toBeTruthy();

    expect(screen.getByText('(10/14)')).toBeTruthy();
  });

  it('shows the average mood as a face, with the exact figure in its label', () => {
    render(<VirtueWeekBreakdown stats={stats} />);

    // 3.5 rounds to Good; 5 is Great. The number is never lost — it stays in
    // the label so a screen reader (and a long press) still gets it.
    expect(screen.getByLabelText('Average mood Good, 3.5 out of 5')).toBeTruthy();
    expect(screen.getByLabelText('Average mood Great, 5 out of 5')).toBeTruthy();
    expect(screen.queryByText('3.5 / 5')).toBeNull();
  });

  it('shows an em dash for average mood when no mood data exists', () => {
    render(<VirtueWeekBreakdown stats={stats} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(2); // Courage and Temperance both have null avgMood
  });
});

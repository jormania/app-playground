// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import WeekdayChart from './WeekdayChart';
import { WeekdayStat } from '../utils/stats';

afterEach(cleanup);

function makeStats(overrides: Partial<Record<string, number>> = {}): WeekdayStat[] {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels.map((label) => ({ label, count: overrides[label] ?? 0, percentage: 0 }));
}

describe('WeekdayChart', () => {
  it('shows the empty state when nothing has been logged', () => {
    render(<WeekdayChart stats={makeStats()} />);
    expect(screen.getByText('No entries in this period yet.')).toBeTruthy();
  });

  it('renders each weekday with its count and percentage once there is data', () => {
    const stats: WeekdayStat[] = [
      { label: 'Sun', count: 0, percentage: 0 },
      { label: 'Mon', count: 3, percentage: 60 },
      { label: 'Tue', count: 2, percentage: 40 },
      { label: 'Wed', count: 0, percentage: 0 },
      { label: 'Thu', count: 0, percentage: 0 },
      { label: 'Fri', count: 0, percentage: 0 },
      { label: 'Sat', count: 0, percentage: 0 },
    ];
    render(<WeekdayChart stats={stats} />);

    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('3 (60%)')).toBeTruthy();
    expect(screen.getByText('2 (40%)')).toBeTruthy();
    expect(screen.getByText('Which weekdays you log on most (5 total in this period)')).toBeTruthy();
  });
});

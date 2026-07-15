// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CycleHeatmap from './CycleHeatmap';
import { CycleHeatmapDay } from '../utils/stats';

afterEach(cleanup);

function makeDays(): CycleHeatmapDay[] {
  const days: CycleHeatmapDay[] = [];
  for (let i = 0; i < 28; i++) {
    const day = 29 + i;
    days.push({
      day,
      dayOfWeek: (i % 7) + 1,
      week: Math.floor(i / 7) + 1,
      logged: i < 5, // days 29-33 logged
      favorited: i === 2, // day 31 favorited
      isFuture: i >= 10, // days 39+ are upcoming
    });
  }
  return days;
}

describe('CycleHeatmap', () => {
  it('renders exactly 28 day cells and the legend', () => {
    render(<CycleHeatmap days={makeDays()} cycle={2} />);

    expect(screen.getByText("Cycle 2's 28 days at a glance")).toBeTruthy();
    expect(screen.getByTitle('Day 31 — logged')).toBeTruthy();
    expect(screen.getByTitle('Day 34 — not logged')).toBeTruthy();
    expect(screen.getByTitle('Day 39 — upcoming')).toBeTruthy();

    expect(screen.getByText('Logged')).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
  });

  it('marks the favorited day with a star, and no other day', () => {
    const { container } = render(<CycleHeatmap days={makeDays()} cycle={2} />);
    const favoritedCell = screen.getByTitle('Day 31 — logged');
    expect(favoritedCell.querySelector('svg')).toBeTruthy();

    const notFavoritedCell = screen.getByTitle('Day 29 — logged');
    expect(notFavoritedCell.querySelector('svg')).toBeFalsy();

    // Exactly one star across the whole grid.
    const stars = container.querySelectorAll('[title^="Day "] svg');
    expect(stars.length).toBe(1);
  });
});

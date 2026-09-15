// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import WeekStrip, { dotLevels } from './WeekStrip.jsx';

afterEach(cleanup);

const density = (over = []) => [
  { date: '2026-09-05', count: 0 },
  { date: '2026-09-06', count: 1 },
  { date: '2026-09-07', count: 4 },
  ...over,
];

/** Counts as a bare list, for the scale's own tests — the dates don't matter
 *  to it, only the shape of the week. */
const levelsOf = (...counts) => dotLevels(counts.map((count, i) => ({ date: `2026-09-0${i + 1}`, count })));

describe('WeekStrip', () => {
  it('renders nothing without a density to show', () => {
    const { container } = render(<WeekStrip density={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders one cell per day, disabling only the ones with nothing on', () => {
    render(<WeekStrip density={density()} />);
    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(3);
    expect(cells[0].disabled).toBe(true);   // 0 productions
    expect(cells[1].disabled).toBe(false);  // 1
    expect(cells[2].disabled).toBe(false);  // 4
  });

  it('scrolls to the matching day section on click', () => {
    document.body.innerHTML = '<section id="day-2026-09-06"></section>';
    const scrollIntoView = document.getElementById('day-2026-09-06').scrollIntoView = vi.fn();
    render(<WeekStrip density={density()} />);
    fireEvent.click(screen.getByTitle(/^1 production ·/));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('a disabled (empty) day does not throw when clicked', () => {
    render(<WeekStrip density={density()} />);
    expect(() => fireEvent.click(screen.getByTitle('Nothing on'))).not.toThrow();
  });

  it('says what the dots mean, since the scale is relative rather than absolute', () => {
    render(<WeekStrip density={density()} />);
    expect(screen.getByTitle('4 productions · one of the week’s busiest')).toBeTruthy();
    expect(screen.getByTitle('1 production · quieter than most of this week')).toBeTruthy();
  });

  it('draws one dot per level', () => {
    const { container } = render(<WeekStrip density={density()} />);
    const cells = [...container.querySelectorAll('.week-strip__day')];
    expect(cells.map((c) => c.querySelectorAll('.week-strip__dots i').length)).toEqual([0, 1, 3]);
  });
});

describe('dotLevels — the scale is relative to the week in view', () => {
  it('discriminates at the volume a full venue list actually produces', () => {
    // The reported bug, in numbers: ~247 events across seven days. Under the old
    // fixed scale (`count <= 3 ? 2 : 3`) every one of these was three dots and
    // the strip said nothing at all. The weekend should stand out from midweek.
    expect(levelsOf(28, 24, 26, 41, 52, 49, 27)).toEqual([2, 2, 2, 3, 3, 3, 2]);
  });

  it('discriminates just as well once a filter shrinks the week', () => {
    // The same seven nights with the Theatre filter on — an order of magnitude
    // fewer productions, and the shape of the week has to survive it. This is
    // why no fixed threshold works: one constant cannot serve both this row and
    // the one above.
    expect(levelsOf(6, 5, 5, 9, 12, 11, 6)).toEqual([2, 2, 2, 3, 3, 3, 2]);
  });

  it('calls a genuinely quiet night quiet, even in a busy week', () => {
    expect(levelsOf(35, 35, 2, 35, 35, 35, 35)).toEqual([2, 2, 1, 2, 2, 2, 2]);
  });

  it('refuses to invent a distinction in a week whose nights are alike', () => {
    // 34 vs 37 is not a difference worth planning around. Splitting it into a
    // 1 and a 3 would be a lie the reader acts on.
    expect(levelsOf(34, 35, 36, 37, 35, 36, 35)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it('uses the median, so one enormous night cannot flatten the other six', () => {
    // With a mean, 300 on Saturday would drag the baseline to ~55 and read every
    // other night as quiet. The median stays at 10, where the week really sits.
    expect(levelsOf(10, 10, 10, 10, 10, 300, 10)).toEqual([2, 2, 2, 2, 2, 3, 2]);
  });

  it('leaves empty days at zero and out of the reckoning', () => {
    expect(levelsOf(0, 0, 3, 20, 0)).toEqual([0, 0, 1, 3, 0]);
  });

  it('handles a week with nothing on at all, and one with a single night', () => {
    expect(levelsOf(0, 0, 0)).toEqual([0, 0, 0]);
    // Nothing to compare against — "typical" is the honest reading, not "busiest".
    expect(levelsOf(0, 7, 0)).toEqual([0, 2, 0]);
  });

  it('survives an absent or malformed density without throwing', () => {
    expect(dotLevels(null)).toEqual([]);
    expect(dotLevels([])).toEqual([]);
    expect(dotLevels([{ date: 'x' }])).toEqual([0]);
  });
});

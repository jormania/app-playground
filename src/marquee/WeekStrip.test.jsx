// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import WeekStrip from './WeekStrip.jsx';

afterEach(cleanup);

const density = (over = []) => [
  { date: '2026-09-05', count: 0 },
  { date: '2026-09-06', count: 1 },
  { date: '2026-09-07', count: 4 },
  ...over,
];

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
    fireEvent.click(screen.getByTitle('1 production'));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('a disabled (empty) day does not throw when clicked', () => {
    render(<WeekStrip density={density()} />);
    expect(() => fireEvent.click(screen.getByTitle('Nothing on'))).not.toThrow();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InsightPeriodFilter from './InsightPeriodFilter';

afterEach(cleanup);

describe('InsightPeriodFilter', () => {
  it('renders all four period options', () => {
    render(<InsightPeriodFilter value="cycle" onChange={() => {}} />);
    expect(screen.getByText('Cycle')).toBeTruthy();
    expect(screen.getByText('Quarter')).toBeTruthy();
    expect(screen.getByText('Year')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('applies the selected style only to the active option', () => {
    render(<InsightPeriodFilter value="quarter" onChange={() => {}} />);
    const quarterBtn = screen.getByText('Quarter');
    const yearBtn = screen.getByText('Year');
    expect(quarterBtn.className).toContain('bg-background-secondary');
    expect(yearBtn.className).not.toContain('bg-background-secondary');
  });

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InsightPeriodFilter value="cycle" onChange={onChange} />);

    await user.click(screen.getByText('Year'));
    expect(onChange).toHaveBeenCalledWith('year');

    await user.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});

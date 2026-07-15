// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding from './Onboarding';
import { getCycleInfo, getCycleDay } from '../utils/date';
import { installMemoryStorage } from '../test-utils/memoryStorage';

installMemoryStorage();

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('Onboarding', () => {
  it('anchors a brand-new user at Cycle 1 / Week 1 by setting cycle-start-date on completion', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);

    await user.click(screen.getByText('Begin Journey'));
    await user.click(screen.getByText('Skip for now'));

    expect(onComplete).toHaveBeenCalledTimes(1);

    const start = localStorage.getItem('daily-stoic:cycle-start-date');
    expect(start).toBeTruthy();

    // The anchor makes "today" land in Cycle 1, Week 1 — never the mid-year
    // day-of-year fallback that would read as "Cycle 7" etc.
    const info = getCycleInfo(getCycleDay(start!));
    expect(info.cycle).toBe(1);
    expect(info.week).toBe(1);
  });

  it('does not overwrite an existing cycle-start-date', async () => {
    localStorage.setItem('daily-stoic:cycle-start-date', '2026-01-05');
    const user = userEvent.setup();
    render(<Onboarding onComplete={() => {}} />);

    await user.click(screen.getByText('Begin Journey'));
    await user.click(screen.getByText('Skip for now'));

    expect(localStorage.getItem('daily-stoic:cycle-start-date')).toBe('2026-01-05');
  });
});

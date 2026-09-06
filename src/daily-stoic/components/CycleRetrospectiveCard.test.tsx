// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CycleRetrospectiveCard from './CycleRetrospectiveCard';
import { CycleRetrospective } from '../utils/retrospective';

afterEach(cleanup);

const retrospective: CycleRetrospective = {
  cycleNumber: 3,
  dateRange: { start: '2026-06-01', end: '2026-06-28' },
  loggedCount: 21,
  consistencyRate: 75,
  reframingsCount: 9,
  passionsCount: 4,
  worriesStats: { total: 5, resolved: 3, rate: 60 },
};

describe('CycleRetrospectiveCard', () => {
  it('renders all four stats with their supporting counts', () => {
    render(<CycleRetrospectiveCard retrospective={retrospective} />);

    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('21 of 28 days logged')).toBeTruthy();

    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('Amor Fati Reframes')).toBeTruthy();

    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('3 of 5 worries cleared')).toBeTruthy();

    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Citadel Vigilance')).toBeTruthy();
  });

  it('renders zeroed stats without error', () => {
    const empty: CycleRetrospective = {
      cycleNumber: 1,
      dateRange: { start: '2026-01-01', end: '2026-01-28' },
      loggedCount: 0,
      consistencyRate: 0,
      reframingsCount: 0,
      passionsCount: 0,
      worriesStats: { total: 0, resolved: 0, rate: 0 },
    };
    render(<CycleRetrospectiveCard retrospective={empty} />);
    expect(screen.getByText('0 of 28 days logged')).toBeTruthy();
    expect(screen.getByText('0 of 0 worries cleared')).toBeTruthy();
  });

  it('drops the two tiles Lite cannot fill when the cycle holds nothing for them', () => {
    const liteCycle: CycleRetrospective = {
      cycleNumber: 4,
      dateRange: { start: '2026-07-01', end: '2026-07-28' },
      loggedCount: 18,
      consistencyRate: 64,
      reframingsCount: 6,
      passionsCount: 0,
      worriesStats: { total: 0, resolved: 0, rate: 0 },
    };
    render(<CycleRetrospectiveCard retrospective={liteCycle} lite />);

    expect(screen.getByText('18 of 28 days logged')).toBeTruthy();
    expect(screen.getByText('Amor Fati Reframes')).toBeTruthy();
    expect(screen.queryByText('Concerns Resolved')).toBeNull();
    expect(screen.queryByText('Citadel Vigilance')).toBeNull();
  });

  it('keeps them in Lite for a cycle that was practised in Full', () => {
    render(<CycleRetrospectiveCard retrospective={retrospective} lite />);

    expect(screen.getByText('3 of 5 worries cleared')).toBeTruthy();
    expect(screen.getByText('Citadel Vigilance')).toBeTruthy();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StreakCounter } from './StreakCounter';

afterEach(cleanup);

describe('StreakCounter', () => {
  it('renders the streak count and labels correctly', () => {
    render(<StreakCounter count={5} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Reflection Streak (5 days)')).toBeTruthy();
  });

  it('handles single day label singularization', () => {
    render(<StreakCounter count={1} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Reflection Streak (1 day)')).toBeTruthy();
  });

  it('allows custom label overrides', () => {
    render(<StreakCounter count={3} label="Stoic Run" />);
    expect(screen.getByText('Stoic Run (3 days)')).toBeTruthy();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MoodGraph from './MoodGraph';

afterEach(cleanup);

describe('MoodGraph', () => {
  it('shows the empty state when no mood has been logged', () => {
    render(<MoodGraph records={[{}, { mood: '' }]} />);
    expect(screen.getByText('Your mood chart is empty.')).toBeTruthy();
  });

  it('ignores records with an unrecognized mood value', () => {
    render(<MoodGraph records={[{ mood: 'Sideways' }]} />);
    expect(screen.getByText('Your mood chart is empty.')).toBeTruthy();
  });

  it('tallies recognized moods and prints matching bar widths and percentages', () => {
    render(
      <MoodGraph
        records={[{ mood: 'Great' }, { mood: 'Great' }, { mood: 'Bad' }, { mood: 'Great' }]}
      />
    );
    expect(screen.getByText('Mood distribution (4 total logged)')).toBeTruthy();
    expect(screen.getByText('3 (75%)')).toBeTruthy();
    expect(screen.getByText('1 (25%)')).toBeTruthy();
  });
});

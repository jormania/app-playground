// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DigestDashboard from './DigestDashboard';
import { ReflectionRecord } from '../services/NotionService';

afterEach(cleanup);

const CYCLE_START = '2026-06-01';

function makeReflection(overrides: Partial<ReflectionRecord> & { date: string; quoteId: number }): ReflectionRecord {
  return {
    text: '',
    fateInput: '',
    acceptanceTags: [],
    favorite: false,
    mood: '',
    morningIntentions: '',
    passions: [],
    createdTime: '',
    dichotomy: '',
    virtue: '',
    ...overrides,
  };
}

describe('DigestDashboard', () => {
  it('shows a loading message instead of the list while loading', () => {
    render(
      <DigestDashboard
        today={5}
        cycleStartDate={CYCLE_START}
        reflections={[]}
        worries={[]}
        loading={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Loading your full history…')).toBeTruthy();
  });

  it('lists days newest-first and intersperses a week-complete entry once a week finishes', () => {
    render(
      <DigestDashboard
        today={8}
        cycleStartDate={CYCLE_START}
        reflections={[makeReflection({ date: '2026-06-01', quoteId: 1, text: 'Day one thoughts' })]}
        worries={[]}
        loading={false}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Day 1 of Week 2 of Cycle 1 (Courage)')).toBeTruthy();
    expect(screen.getByText('Week 1 Complete — Wisdom')).toBeTruthy();
    expect(screen.getByText('Day 1 of Week 1 of Cycle 1 (Wisdom)')).toBeTruthy();
  });

  it('opens a day modal with the reflection content on click, showing what "Favorited" refers to', async () => {
    const user = userEvent.setup();
    render(
      <DigestDashboard
        today={1}
        cycleStartDate={CYCLE_START}
        reflections={[
          makeReflection({
            date: '2026-06-01',
            quoteId: 1,
            text: '### What went well?\nStayed calm.',
            favorite: true,
            mood: 'Good',
          }),
        ]}
        worries={[]}
        loading={false}
        onClose={() => {}}
      />
    );

    await user.click(screen.getByText('Day 1 of Week 1 of Cycle 1 (Wisdom)'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText("Today's Quote")).toBeTruthy();
    expect(screen.getByText('Favorited')).toBeTruthy();
    expect(screen.getByText('What went well?')).toBeTruthy();
    expect(screen.getByText('Stayed calm.')).toBeTruthy();
    expect(screen.getByText('Good')).toBeTruthy();
  });

  it('shows a plain "no reflection" message for a day with nothing logged', async () => {
    const user = userEvent.setup();
    render(
      <DigestDashboard
        today={1}
        cycleStartDate={CYCLE_START}
        reflections={[]}
        worries={[]}
        loading={false}
        onClose={() => {}}
      />
    );

    await user.click(screen.getByText('Day 1 of Week 1 of Cycle 1 (Wisdom)'));
    expect(screen.getByText('No reflection recorded for this day.')).toBeTruthy();
  });

  it('opens the full retrospective modal from a completed cycle entry', async () => {
    const user = userEvent.setup();
    render(
      <DigestDashboard
        today={29}
        cycleStartDate={CYCLE_START}
        reflections={[makeReflection({ date: '2026-06-01', quoteId: 1, fateInput: 'reframed it' })]}
        worries={[]}
        loading={false}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('🌟 Cycle 1 Complete')).toBeTruthy();
    await user.click(screen.getByText('View full retrospective'));

    expect(screen.getByText('Cycle 1 Retrospective')).toBeTruthy();
    expect(screen.getByText('Amor Fati Reframes')).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DigestDashboard
        today={1}
        cycleStartDate={CYCLE_START}
        reflections={[]}
        worries={[]}
        loading={false}
        onClose={onClose}
      />
    );
    await user.click(screen.getByTitle('Close Digest'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

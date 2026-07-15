// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommitmentsPanel from './CommitmentsPanel';
import { parseCommitments, COMMITMENTS_KEY } from '../lib/commitments';
import { installMemoryStorage } from '../test-utils/memoryStorage';

installMemoryStorage();

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function ledger() {
  return parseCommitments(localStorage.getItem(COMMITMENTS_KEY));
}

describe('CommitmentsPanel — prepare mode', () => {
  it('records a provable promise for today and persists it as open', async () => {
    const user = userEvent.setup();
    render(<CommitmentsPanel today={5} mode="prepare" />);

    await user.type(
      screen.getByPlaceholderText(/answer the hard email/i),
      'walk after lunch',
    );
    await user.click(screen.getByRole('button', { name: /commit/i }));

    const list = ledger();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: 'walk after lunch', createdDay: 5, status: 'open', source: 'self' });
    expect(screen.getByText('walk after lunch')).toBeTruthy();
  });

  it('surfaces an unreckoned promise from an earlier day as a debt', () => {
    localStorage.setItem(
      COMMITMENTS_KEY,
      JSON.stringify([
        { id: 'old', text: 'old promise', createdDay: 2, status: 'open', source: 'self', createdAt: '' },
      ]),
    );
    render(<CommitmentsPanel today={5} mode="prepare" />);
    expect(screen.getByText(/unreckoned promises/i)).toBeTruthy();
    expect(screen.getByText('3 days owed')).toBeTruthy();
  });
});

describe('CommitmentsPanel — reckon mode', () => {
  beforeEach(() => {
    localStorage.setItem(
      COMMITMENTS_KEY,
      JSON.stringify([
        { id: 'a', text: 'promise A', createdDay: 5, status: 'open', source: 'self', createdAt: '' },
      ]),
    );
  });

  it('marks a due promise as kept and moves it to the reckoned list', async () => {
    const user = userEvent.setup();
    render(<CommitmentsPanel today={5} mode="reckon" />);

    await user.click(screen.getByRole('button', { name: /kept/i }));

    expect(ledger()[0]).toMatchObject({ status: 'kept', resolvedDay: 5 });
    const reckoned = screen.getByText(/reckoned tonight/i).closest('div')!;
    expect(within(reckoned).getByText('promise A')).toBeTruthy();
  });

  it('can undo a reckoning back to open', async () => {
    const user = userEvent.setup();
    render(<CommitmentsPanel today={5} mode="reckon" />);

    await user.click(screen.getByRole('button', { name: /broke it/i }));
    expect(ledger()[0].status).toBe('broken');

    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect(ledger()[0].status).toBe('open');
  });

  it('shows an empty state when there is nothing to reckon', () => {
    localStorage.clear();
    render(<CommitmentsPanel today={5} mode="reckon" />);
    expect(screen.getByText(/No promise to reckon/i)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SmartTextEntry from './SmartTextEntry';
import { parseTextWithAI } from '../lib/aiParser';

vi.mock('../lib/aiParser', () => ({
  parseTextWithAI: vi.fn(),
  // The keyword path runs its result through the same hardening as the AI
  // path; mocked as a pass-through so these tests stay about the component.
  hardenTransactions: vi.fn(async (txs) => txs),
}));

/** A minimal fake SpeechRecognition — jsdom has no real one. Captures the
 * instance so a test can drive its callbacks directly. A constructor function
 * that explicitly returns an object, called with `new`, hands back that
 * object instead of `this` — no `this`-aliasing needed. */
function installFakeSpeechRecognition() {
  let instance = null;
  function FakeSpeechRecognition() {
    instance = { continuous: false, interimResults: false, lang: '', start: vi.fn(), stop: vi.fn() };
    return instance;
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
  return () => instance;
}

describe('SmartTextEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  afterEach(() => {
    cleanup();
    // The trip notice outlives its component on purpose — so it has to be
    // cleared between tests, or one test's card shows up in the next.
    sessionStorage.clear();
  });

  it('handles regular AI transaction addition', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-1' });
    const onSuccess = vi.fn();
    
    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch' }
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onSuccess={onSuccess} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ amount: 15 }));
    });
    expect(onSuccess).toHaveBeenCalledWith(['tx-1']);
    expect(screen.getByText('Added 15 RON · Lunch')).toBeDefined();
  });

  it('handles updates via AI', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ id: 'tx-2' });
    
    parseTextWithAI.mockResolvedValue([
      { action: 'update', id: 'tx-2', amount: 20, description: 'Dinner' }
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onUpdate={onUpdate} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'update dinner to 20' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('tx-2', expect.objectContaining({ amount: 20 }));
    });
    expect(screen.getByText('Updated transaction.')).toBeDefined();
  });

  it('shows subscription prompt when detected', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-3' });
    const onAddSubscription = vi.fn();
    
    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 10, description: 'Spotify', isSubscription: true }
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onAddSubscription={onAddSubscription} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Spotify 10' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('Recurring Bill Detected')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(onAddSubscription).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Spotify',
        amount: 10
      }));
    });
    
    expect(screen.queryByText('Recurring Bill Detected')).toBeNull();
  });

  it('holds a delete for explicit confirmation instead of running it immediately', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    parseTextWithAI.mockResolvedValue([
      { action: 'delete', id: 'tx-9' }
    ]);

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        onDelete={onDelete}
        recentTransactions={[{ id: 'tx-9', description: 'Coffee', amount: 12 }]}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete the coffee' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('Delete this transaction?')).toBeDefined();
    });
    // Nothing has run yet — the whole point of the checkpoint.
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/"Coffee" \(12 L\)/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('tx-9');
    });
    expect(screen.getByText('Deleted transaction.')).toBeDefined();
  });

  it('cancelling the delete confirmation runs nothing', async () => {
    const onDelete = vi.fn();

    parseTextWithAI.mockResolvedValue([
      { action: 'delete', id: 'tx-9' }
    ]);

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        onDelete={onDelete}
        recentTransactions={[{ id: 'tx-9', description: 'Coffee', amount: 12 }]}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete the coffee' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('Delete this transaction?')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete this transaction?')).toBeNull();
    });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does not gate a batch that has no delete action', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-1' });

    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch' },
      { action: 'create', amount: 25, description: 'Groceries' },
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 lunch and 25 groceries' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(/Delete/)).toBeNull();
  });

  it('reports partial progress and still refreshes when a batch fails partway through', async () => {
    const onAdd = vi.fn()
      .mockResolvedValueOnce({ id: 'tx-1' })
      .mockRejectedValueOnce(new Error('Notion is unreachable'));
    const onSuccess = vi.fn();

    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch' },
      { action: 'create', amount: 25, description: 'Groceries' },
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 lunch and 25 groceries' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText(/1 added before this failed/)).toBeDefined();
    });
    // The one that did succeed is still reported so the ledger refreshes.
    expect(onSuccess).toHaveBeenCalledWith(['tx-1']);
  });

  it('says when a transaction landed on a trip, and offers to change it', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-9' });
    const onEditTransaction = vi.fn();

    parseTextWithAI.mockResolvedValue([{
      action: 'create',
      amount: 36,
      originalAmount: 30,
      originalCurrency: 'PLN',
      description: 'Lunch at Restaurant',
      categoryId: 'cat-travel',
      tripId: 'trip-poland',
    }]);

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        trips={[{ id: 'trip-poland', name: 'Poland Autumn' }]}
        categories={[{ id: 'cat-travel', name: 'Travel', type: 'Expense' }]}
        onAdd={onAdd}
        onEditTransaction={onEditTransaction}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '30 zl for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText(/added to your/)).toBeDefined();
    });
    // The word "trip" has to be present: naming the trip isn't the same as
    // saying one was attached.
    expect(screen.getByText(/Poland Autumn.*trip/)).toBeDefined();
    expect(screen.getByText(/filed under Travel/)).toBeDefined();
    expect(screen.getByText(/recorded as 30 PLN/)).toBeDefined();

    fireEvent.click(screen.getByText('Change'));
    expect(onEditTransaction).toHaveBeenCalledWith('tx-9');
  });

  it('survives the ledger refresh tearing the screen down and back up', async () => {
    // Saving kicks off a refresh, and a refresh with no mirrored copy to paint
    // flips the whole tab to the skeleton until Notion answers — unmounting
    // this component a few seconds after the card appeared. That read as an
    // auto-dismiss; the card is supposed to wait for an answer.
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-11' });
    parseTextWithAI.mockResolvedValue([{
      action: 'create', amount: 36, originalAmount: 30, originalCurrency: 'PLN',
      description: 'Lunch at Restaurant', categoryId: 'cat-travel', tripId: 'trip-poland',
    }]);

    const props = {
      config: { features: { aiParser: true }, claudeApiKey: 'key' },
      trips: [{ id: 'trip-poland', name: 'Poland Autumn' }],
      categories: [{ id: 'cat-travel', name: 'Travel', type: 'Expense' }],
      onAdd,
    };

    const { unmount } = render(<SmartTextEntry {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '30 zl for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/added to your/)).toBeDefined());

    unmount();
    render(<SmartTextEntry {...props} />);
    expect(screen.getByText(/Poland Autumn.*trip/)).toBeDefined();
  });

  it('is gone for good once you say Got it', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-12' });
    parseTextWithAI.mockResolvedValue([{
      action: 'create', amount: 36, description: 'Lunch at Restaurant',
      categoryId: 'cat-travel', tripId: 'trip-poland',
    }]);

    const props = {
      config: { features: { aiParser: true }, claudeApiKey: 'key' },
      trips: [{ id: 'trip-poland', name: 'Poland Autumn' }],
      categories: [{ id: 'cat-travel', name: 'Travel', type: 'Expense' }],
      onAdd,
    };

    const { unmount } = render(<SmartTextEntry {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '30 zl for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.getByText(/added to your/)).toBeDefined());

    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText(/added to your/)).toBeNull();

    // And it doesn't come back on the next refresh, either.
    unmount();
    render(<SmartTextEntry {...props} />);
    expect(screen.queryByText(/added to your/)).toBeNull();
  });

  it('does not resurrect a confirmation for a save long since forgotten', () => {
    sessionStorage.setItem('whereItWent_trip_notice', JSON.stringify({
      savedAt: Date.now() - 6 * 60 * 1000,
      notice: { id: 'tx-old', others: 0, tx: { description: 'Lunch', tripId: 'trip-poland' } },
    }));

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        trips={[{ id: 'trip-poland', name: 'Poland Autumn' }]}
        categories={[]}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.queryByText(/added to your/)).toBeNull();
  });

  it('reports the foreign figure, not the RON one wearing its currency code', async () => {
    // "Added 82 PLN" for a 67 PLN shop that converts to 82 RON: both numbers
    // are real and both show in the ledger, so the mismatch read as the app
    // disagreeing with itself.
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-8' });
    parseTextWithAI.mockResolvedValue([{
      action: 'create', amount: 82, originalAmount: 67, originalCurrency: 'PLN',
      description: 'Shopping at Żabka', categoryId: 'cat-food',
    }]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '67 zl at zabka' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByText(/Added 67 PLN/)).toBeDefined());
    expect(screen.queryByText(/82 PLN/)).toBeNull();
  });

  it('does not stack a toast on top of the trip card saying the same thing', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-7' });
    parseTextWithAI.mockResolvedValue([{
      action: 'create', amount: 82, originalAmount: 67, originalCurrency: 'PLN',
      description: 'Shopping at Żabka', categoryId: 'cat-travel', tripId: 'trip-poland',
    }]);

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        trips={[{ id: 'trip-poland', name: '2026 - Poland' }]}
        categories={[{ id: 'cat-travel', name: 'Travel', type: 'Expense' }]}
        onAdd={onAdd}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '67 zl at zabka' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByText(/added to your/)).toBeDefined());
    expect(screen.queryByText(/^Added /)).toBeNull();
  });

  it('stays quiet for a transaction with no trip', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-10' });
    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch', categoryId: 'cat-food' },
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('sets the recognizer language from the browser locale', () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartTextEntry config={{}} />);
    expect(getInstance().lang).toBe(navigator.language || 'en-US');
  });

  it('shows a clear message when the microphone permission is denied', async () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartTextEntry config={{}} />);

    getInstance().onerror({ error: 'not-allowed' });

    await waitFor(() => {
      expect(screen.getByText(/Microphone access was denied/)).toBeDefined();
    });
  });

  it('stays quiet on a no-speech error rather than showing one', async () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartTextEntry config={{}} />);

    getInstance().onerror({ error: 'no-speech' });

    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText(/Dictation failed/)).toBeNull();
    expect(screen.queryByText(/Microphone access/)).toBeNull();
  });
});

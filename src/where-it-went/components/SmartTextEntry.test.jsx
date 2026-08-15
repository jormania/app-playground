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
  });

  it('reports every save to the notice, not only the ones on a trip', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-1' });
    const onSaved = vi.fn();

    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch', categoryId: 'cat-food' },
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onSaved={onSaved} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tx-1', action: 'create', others: 0,
    })));
    // And no toast underneath it saying a thinner version of the same thing.
    expect(screen.queryByText(/^Added /)).toBeNull();
  });

  it('counts the rest of a batch rather than reporting each one', async () => {
    const onAdd = vi.fn()
      .mockResolvedValueOnce({ id: 'tx-a' })
      .mockResolvedValueOnce({ id: 'tx-b' })
      .mockResolvedValueOnce({ id: 'tx-c' });
    const onSaved = vi.fn();

    parseTextWithAI.mockResolvedValue([
      { action: 'create', amount: 15, description: 'Lunch' },
      { action: 'create', amount: 25, description: 'Groceries' },
      { action: 'create', amount: 8, description: 'Coffee' },
    ]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onSaved={onSaved} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 lunch, 25 groceries, 8 coffee' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tx-a', others: 2,
    })));
  });

  it('describes an update as the row now stands, not as the patch alone', async () => {
    // The parser sends only what changed. On its own that would report a
    // transaction with no category, no account and no trip — none of which
    // the update touched.
    const onUpdate = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn();

    parseTextWithAI.mockResolvedValue([{ action: 'update', id: 'tx-2', amount: 200 }]);

    render(
      <SmartTextEntry
        config={{ features: { aiParser: true }, claudeApiKey: 'key' }}
        transactions={[{ id: 'tx-2', amount: 150, description: 'Gym membership', categoryId: 'cat-health', accountId: 'acc-1' }]}
        onUpdate={onUpdate}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'change the gym membership to 200' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tx-2',
      action: 'update',
      tx: expect.objectContaining({
        amount: 200, description: 'Gym membership', categoryId: 'cat-health', accountId: 'acc-1',
      }),
    })));
  });

  it('clears the previous notice the moment a new message is submitted', async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: 'tx-1' });
    const onSaved = vi.fn();
    parseTextWithAI.mockResolvedValue([{ action: 'create', amount: 15, description: 'Lunch' }]);

    render(<SmartTextEntry config={{ features: { aiParser: true }, claudeApiKey: 'key' }} onAdd={onAdd} onSaved={onSaved} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '15 for lunch' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' })));
    expect(onSaved).toHaveBeenNthCalledWith(1, null);
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

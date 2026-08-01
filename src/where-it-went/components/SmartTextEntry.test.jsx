// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SmartTextEntry from './SmartTextEntry';
import { parseTextWithAI } from '../lib/aiParser';

vi.mock('../lib/aiParser', () => ({
  parseTextWithAI: vi.fn(),
}));

describe('SmartTextEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText('Added: 15 RON for Lunch')).toBeDefined();
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
});

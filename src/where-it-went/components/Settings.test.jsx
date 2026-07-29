// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Settings from './Settings';

afterEach(() => {
  cleanup();
});

vi.mock('../lib/notionClient', () => {
  return {
    NotionClient: class {
      fetchCategories() { return Promise.resolve([]); }
      fetchAccounts() { return Promise.resolve([]); }
      fetchTransactions() { return Promise.resolve([]); }
      fetchSubscriptions() { return Promise.resolve([]); }
      fetchTrips() { return Promise.resolve([]); }
    }
  };
});

describe('Settings Component', () => {
  it('loads config and saves changes', async () => {
    const mockConfig = {
      token: 'secret_token',
      categoriesDb: 'cat_id',
      accountsDb: 'acc_id',
      transactionsDb: 'tx_id',
      theme: 'dark'
    };
    const onSave = vi.fn();
    const onThemeChange = vi.fn();

    render(<Settings config={mockConfig} onSave={onSave} onThemeChange={onThemeChange} onDone={vi.fn()} />);

    // Verify inputs have correct default values
    expect(screen.getByDisplayValue('secret_token')).toBeDefined();
    expect(screen.getByDisplayValue('cat_id')).toBeDefined();

    // Change a value
    const tokenInput = screen.getByDisplayValue('secret_token');
    fireEvent.change(tokenInput, { target: { value: 'new_token' } });

    // Click save
    fireEvent.click(screen.getByText('Save Configuration'));
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        token: 'new_token',
        categoriesDb: 'cat_id'
      }));
    });
  });

  it('clears the configuration instead of crashing when every field is emptied and saved', async () => {
    // Regression: handleSave used to call a `handleClear` that did not exist
    // anywhere in the file, throwing a ReferenceError with the form stuck.
    const mockConfig = { token: '', categoriesDb: '', accountsDb: '', transactionsDb: '', theme: 'dark' };
    const onSave = vi.fn();

    render(<Settings config={mockConfig} onSave={onSave} onThemeChange={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ token: '', transactionsDb: '' }));
    });
    expect(screen.getByText(/configuration cleared/i)).toBeDefined();
  });

  it('Transfers feature toggle defaults off and can be turned on and saved', async () => {
    const mockConfig = {
      token: 'secret_token', categoriesDb: 'cat_id', accountsDb: 'acc_id', transactionsDb: 'tx_id', theme: 'dark'
    };
    const onSave = vi.fn();

    render(<Settings config={mockConfig} onSave={onSave} onThemeChange={vi.fn()} onDone={vi.fn()} />);

    const transfersToggle = screen.getByLabelText('Transfers');
    expect(transfersToggle.checked).toBe(false);

    fireEvent.click(transfersToggle);
    expect(transfersToggle.checked).toBe(true);

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        features: expect.objectContaining({ transfers: true })
      }));
    });
  });
});

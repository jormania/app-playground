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
      // demoMode must be set too: the message claims demo mode, and without the
      // flag the app served fixtures while the engine/outbox treated them as real.
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ token: '', transactionsDb: '', demoMode: true }),
      );
    });
    expect(screen.getByText(/now in demo mode/i)).toBeDefined();
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

  it('Upcoming activity toggle defaults ON, including for a config saved before the key existed', () => {
    // The stored features object predates `upcoming`, so the checkbox has to
    // read `!== false` rather than a truthy check — otherwise every existing
    // user would silently have the feature off with no way to know why.
    const mockConfig = {
      token: 'secret_token', categoriesDb: 'cat_id', accountsDb: 'acc_id', transactionsDb: 'tx_id',
      theme: 'dark', features: { budgeting: true, cashFlow: true, transfers: false }
    };

    render(<Settings config={mockConfig} onSave={vi.fn()} onThemeChange={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByLabelText('Upcoming activity').checked).toBe(true);
  });

  it('turning Upcoming activity off hides the lead-time input and saves the flag', async () => {
    const mockConfig = {
      token: 'secret_token', categoriesDb: 'cat_id', accountsDb: 'acc_id', transactionsDb: 'tx_id',
      theme: 'dark', subscriptionsDb: 'sub_id'
    };
    const onSave = vi.fn();

    render(
      <Settings
        config={mockConfig} onSave={onSave} onThemeChange={vi.fn()} onDone={vi.fn()}
        data={{ subscriptions: [], categories: [], accounts: [] }}
      />
    );

    expect(screen.getByLabelText(/warn me this many days ahead/i)).toBeDefined();

    fireEvent.click(screen.getByLabelText('Upcoming activity'));
    expect(screen.queryByLabelText(/warn me this many days ahead/i)).toBeNull();

    fireEvent.click(screen.getByText('Save Configuration'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        features: expect.objectContaining({ upcoming: false })
      }));
    });
  });

  it('persists a custom lead time', async () => {
    const mockConfig = {
      token: 'secret_token', categoriesDb: 'cat_id', accountsDb: 'acc_id', transactionsDb: 'tx_id',
      theme: 'dark', subscriptionsDb: 'sub_id'
    };
    const onSave = vi.fn();

    render(
      <Settings
        config={mockConfig} onSave={onSave} onThemeChange={vi.fn()} onDone={vi.fn()}
        data={{ subscriptions: [], categories: [], accounts: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText(/warn me this many days ahead/i), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ upcomingLeadDays: 10 }));
    });
  });
});

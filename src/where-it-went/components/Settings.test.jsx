// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from './Settings';

describe('Settings Component', () => {
  it('loads config and saves changes', () => {
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
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      token: 'new_token',
      categoriesDb: 'cat_id'
    }));
  });
});

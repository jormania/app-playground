import { describe, it, expect } from 'vitest';
import { formatAccountLabel, accountLabelById } from './accounts';

describe('formatAccountLabel', () => {
  it('prefixes the icon when there is one', () => {
    expect(formatAccountLabel({ name: 'Revolut', icon: '📱', currency: 'RON' })).toBe('📱 Revolut');
  });

  it('works fine without an icon', () => {
    expect(formatAccountLabel({ name: 'Checking', currency: 'RON' })).toBe('Checking');
  });

  it('appends the currency only when it differs from the base', () => {
    // With two accounts legitimately called "Revolut", the suffix is the only
    // thing telling them apart — so it must never be dropped for a non-RON one.
    expect(formatAccountLabel({ name: 'Revolut', icon: '💶', currency: 'EUR' })).toBe('💶 Revolut (EUR)');
    expect(formatAccountLabel({ name: 'Revolut', icon: '📱', currency: 'RON' })).not.toMatch(/\(/);
  });

  it('treats a missing currency as the base currency', () => {
    expect(formatAccountLabel({ name: 'Cash' })).toBe('Cash');
  });

  it('falls back rather than rendering "undefined"', () => {
    expect(formatAccountLabel(null)).toBe('—');
    expect(formatAccountLabel(undefined, { fallback: '— No account' })).toBe('— No account');
    expect(formatAccountLabel({ name: '' })).toBe('—');
  });
});

describe('accountLabelById', () => {
  const byId = new Map([
    ['a1', { id: 'a1', name: 'Cash', icon: '💵', currency: 'RON' }],
    ['a2', { id: 'a2', name: 'Revolut', icon: '💶', currency: 'EUR' }],
  ]);

  it('resolves through the lookup map', () => {
    expect(accountLabelById(byId, 'a1')).toBe('💵 Cash');
    expect(accountLabelById(byId, 'a2')).toBe('💶 Revolut (EUR)');
  });

  it('falls back for an unknown or missing id', () => {
    expect(accountLabelById(byId, 'nope')).toBe('—');
    expect(accountLabelById(null, 'a1')).toBe('—');
  });
});

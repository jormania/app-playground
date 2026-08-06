import { describe, it, expect } from 'vitest';
import { selectableCategories, compareCategories } from './categories';

const categories = [
  { id: 'cat-groceries', name: 'Groceries', type: 'Expense', active: true },
  { id: 'cat-other', name: 'Other', type: 'Expense', active: false },
  { id: 'cat-dining', name: 'Dining', type: 'Expense' }, // no `active` at all — reads as active
  { id: 'cat-utilities', name: 'Utilities', type: 'Expense', active: true }, // alphabetically after "Other"
  { id: 'cat-salary', name: 'Salary', type: 'Income', active: true },
];

describe('compareCategories', () => {
  it('sorts "Other" last even when it would alphabetize earlier', () => {
    const result = [...categories.filter(c => c.type === 'Expense'), { id: 'x', name: 'Utilities' }]
      .sort(compareCategories);
    expect(result[result.length - 1].name).toBe('Other');
  });

  it('sorts everything else alphabetically around "Other"', () => {
    const result = [
      { id: '1', name: 'Zebra' }, { id: '2', name: 'Other' }, { id: '3', name: 'Apple' },
    ].sort(compareCategories);
    expect(result.map(c => c.name)).toEqual(['Apple', 'Zebra', 'Other']);
  });

  it('is stable when "Other" appears once', () => {
    const result = [{ id: '1', name: 'Other' }].sort(compareCategories);
    expect(result.map(c => c.name)).toEqual(['Other']);
  });
});

describe('selectableCategories', () => {
  it('excludes inactive categories by default', () => {
    const result = selectableCategories(categories, 'Expense');
    expect(result.map(c => c.id).sort()).toEqual(['cat-dining', 'cat-groceries', 'cat-utilities'].sort());
  });

  it('treats a missing `active` field as active — old rows saved before the checkbox existed', () => {
    const result = selectableCategories(categories, 'Expense');
    expect(result.some(c => c.id === 'cat-dining')).toBe(true);
  });

  it('keeps an inactive category when it is the one currently selected', () => {
    const result = selectableCategories(categories, 'Expense', 'cat-other');
    expect(result.map(c => c.id)).toContain('cat-other');
  });

  it('still excludes other inactive categories even while preserving the selected one', () => {
    // Only one inactive category exists in the fixture, so this asserts the
    // preserved list isn't just "all categories" — it's exactly Other plus
    // whatever was already active.
    const result = selectableCategories(categories, 'Expense', 'cat-other');
    expect(result.map(c => c.id).sort()).toEqual(['cat-dining', 'cat-groceries', 'cat-other', 'cat-utilities'].sort());
  });

  it('filters by type', () => {
    const result = selectableCategories(categories, 'Income');
    expect(result.map(c => c.id)).toEqual(['cat-salary']);
  });

  it('sorts alphabetically, with "Other" always last regardless of where it would alphabetize', () => {
    const result = selectableCategories(categories, 'Expense', 'cat-other');
    // "Other" alphabetizes between Groceries and Utilities — it must not land there.
    expect(result.map(c => c.name)).toEqual(['Dining', 'Groceries', 'Utilities', 'Other']);
  });

  it('handles an empty or missing category list', () => {
    expect(selectableCategories([], 'Expense')).toEqual([]);
    expect(selectableCategories(null, 'Expense')).toEqual([]);
    expect(selectableCategories(undefined, 'Expense')).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { selectableCategories } from './categories';

const categories = [
  { id: 'cat-groceries', name: 'Groceries', type: 'Expense', active: true },
  { id: 'cat-other', name: 'Other', type: 'Expense', active: false },
  { id: 'cat-dining', name: 'Dining', type: 'Expense' }, // no `active` at all — reads as active
  { id: 'cat-salary', name: 'Salary', type: 'Income', active: true },
];

describe('selectableCategories', () => {
  it('excludes inactive categories by default', () => {
    const result = selectableCategories(categories, 'Expense');
    expect(result.map(c => c.id)).toEqual(['cat-dining', 'cat-groceries']);
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
    expect(result.map(c => c.id).sort()).toEqual(['cat-dining', 'cat-groceries', 'cat-other'].sort());
  });

  it('filters by type', () => {
    const result = selectableCategories(categories, 'Income');
    expect(result.map(c => c.id)).toEqual(['cat-salary']);
  });

  it('sorts alphabetically by name', () => {
    const result = selectableCategories(categories, 'Expense', 'cat-other');
    expect(result.map(c => c.name)).toEqual(['Dining', 'Groceries', 'Other']);
  });

  it('handles an empty or missing category list', () => {
    expect(selectableCategories([], 'Expense')).toEqual([]);
    expect(selectableCategories(null, 'Expense')).toEqual([]);
    expect(selectableCategories(undefined, 'Expense')).toEqual([]);
  });
});

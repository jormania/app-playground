import { describe, it, expect } from 'vitest';
import { hasContent } from './logged';
import type { ReflectionRecord } from '../services/NotionService';

const day = (overrides: Partial<ReflectionRecord> = {}): ReflectionRecord => ({
  date: '2026-09-07',
  quoteId: 1,
  text: '',
  fateInput: '',
  acceptanceTags: [],
  favorite: false,
  mood: '',
  morningIntentions: '',
  passions: [],
  virtue: '',
  ...overrides,
});

describe('hasContent — what counts as a day practised', () => {
  it('does not count a day that was only favourited', () => {
    expect(hasContent(day({ favorite: true }))).toBe(false);
  });

  it('does not count an empty record, or no record at all', () => {
    expect(hasContent(day())).toBe(false);
    expect(hasContent(day({ text: '   ', fateInput: '\n' }))).toBe(false);
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(null)).toBe(false);
  });

  it('counts anything written or chosen', () => {
    expect(hasContent(day({ text: 'A quiet day.' }))).toBe(true);
    expect(hasContent(day({ mood: 'Good' }))).toBe(true);
    expect(hasContent(day({ fateInput: 'a cancelled train' }))).toBe(true);
    expect(hasContent(day({ acceptanceTags: ['Time'] }))).toBe(true);
    expect(hasContent(day({ morningIntentions: 'Expect delays.' }))).toBe(true);
    expect(hasContent(day({ passions: ['impatience'] }))).toBe(true);
    expect(hasContent(day({ virtue: 'Courage' }))).toBe(true);
  });

  it('still counts a practised day that was also favourited', () => {
    expect(hasContent(day({ favorite: true, mood: 'Great' }))).toBe(true);
  });
});

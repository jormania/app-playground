import { describe, it, expect } from 'vitest';
import { getCategoryColor, CHART_COLORS } from './colors';

describe('colors.js', () => {
  it('returns a muted color when categoryName is falsy', () => {
    expect(getCategoryColor(null)).toBe('var(--color-muted)');
    expect(getCategoryColor('')).toBe('var(--color-muted)');
    expect(getCategoryColor(undefined)).toBe('var(--color-muted)');
  });

  it('returns a consistent color for the same category name', () => {
    const color1 = getCategoryColor('Dining');
    const color2 = getCategoryColor('Dining');
    expect(color1).toBe(color2);
    expect(CHART_COLORS).toContain(color1);
  });

  it('returns different colors for different category names (usually)', () => {
    const color1 = getCategoryColor('Dining');
    const color2 = getCategoryColor('Entertainment');
    // While there could be a hash collision, these two specifically should hash differently
    expect(color1).not.toBe(color2);
  });

  it('handles small strings', () => {
    expect(CHART_COLORS).toContain(getCategoryColor('A'));
  });

  it('handles very long strings', () => {
    const longString = 'Averylongcategorynamethatgoesonsonandonandonandonandon';
    expect(CHART_COLORS).toContain(getCategoryColor(longString));
  });
});

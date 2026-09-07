import { describe, it, expect } from 'vitest';
import { MOODS, MOOD_SCORES, moodByValue, moodForScore } from './moods';

describe('the mood vocabulary', () => {
  it('keeps the five values and their scores', () => {
    expect(MOODS.map((m) => m.value)).toEqual(['Great', 'Good', 'Neutral', 'Bad', 'Awful']);
    expect(MOOD_SCORES).toEqual({ Great: 5, Good: 4, Neutral: 3, Bad: 2, Awful: 1 });
  });

  it('gives every mood a face', () => {
    expect(MOODS.every((m) => typeof m.Icon === 'function' || typeof m.Icon === 'object')).toBe(true);
    expect(new Set(MOODS.map((m) => m.Icon)).size).toBe(5);
  });

  it('looks a mood up by its stored value', () => {
    expect(moodByValue('Neutral')?.score).toBe(3);
    expect(moodByValue('')).toBeUndefined();
    expect(moodByValue(undefined)).toBeUndefined();
  });

  it('lands an average on the nearest face, clamped to the scale', () => {
    expect(moodForScore(3).value).toBe('Neutral');
    expect(moodForScore(3.5).value).toBe('Good');
    expect(moodForScore(3.4).value).toBe('Neutral');
    expect(moodForScore(0).value).toBe('Awful');
    expect(moodForScore(9).value).toBe('Great');
  });
});

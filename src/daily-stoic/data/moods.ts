import { SmilePlus, Smile, Meh, Frown, Angry, type LucideIcon } from 'lucide-react';

/**
 * The five moods, in one place: their order, their icon, and their score.
 *
 * The icon is part of the vocabulary, not decoration — the same face means the
 * same thing in the Lite mood row, the MoodGraph and the Virtue Week
 * Breakdown's average. Three copies of this map used to drift; anything that
 * shows a mood reads it from here.
 */
export interface Mood {
  /** Stored verbatim in Notion's Mood select — never change these strings. */
  value: string;
  score: number;
  Icon: LucideIcon;
}

export const MOODS: Mood[] = [
  { value: 'Great', score: 5, Icon: SmilePlus },
  { value: 'Good', score: 4, Icon: Smile },
  { value: 'Neutral', score: 3, Icon: Meh },
  { value: 'Bad', score: 2, Icon: Frown },
  { value: 'Awful', score: 1, Icon: Angry },
];

export const MOOD_SCORES: Record<string, number> = Object.fromEntries(
  MOODS.map((m) => [m.value, m.score])
);

export function moodByValue(value: string | undefined | null): Mood | undefined {
  return MOODS.find((m) => m.value === value);
}

/** The mood an average score reads as — the average of a week of moods is a
 *  fraction, and a face has to land on one of the five. Rounds to nearest;
 *  callers keep the exact number in the label so nothing is lost. */
export function moodForScore(score: number): Mood {
  const rounded = Math.min(5, Math.max(1, Math.round(score)));
  return MOODS.find((m) => m.score === rounded) ?? MOODS[2]!;
}

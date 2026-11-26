/**
 * Stillflow's closed vocabularies. Every filterable dimension of a session draws
 * from one of these lists, so a filter chip, an import validator and the
 * editor all agree on spelling. A value outside its list is kept on import
 * (never silently dropped) but flagged as unknown.
 */

export const STYLES = [
  'Vinyasa', 'Hatha', 'Power Yoga', 'Restorative', 'Yin Yoga', 'Gentle Yoga',
  'Slow Flow', 'Morning Yoga', 'Evening Yoga', 'Meditation', 'Breathwork', 'Yoga Nidra',
] as const

/**
 * Your rating is how much you'd like to come back to a session, not a verdict
 * on its quality. 0 means not rated yet.
 */
export const REPEAT_LABELS = ['Once was enough', 'Maybe some day', 'Happy to repeat', 'Want to repeat', 'A staple'] as const

/** "A staple": the top of the repeat scale, which also makes the session a favourite. */
export const STAPLE = REPEAT_LABELS.length

export function repeatLabel(r: number | undefined): string {
  return r && r >= 1 && r <= 5 ? REPEAT_LABELS[r - 1] : 'Not rated'
}

export const INTENSITY_LABELS = ['Very gentle', 'Gentle', 'Moderate', 'Challenging', 'Very challenging'] as const

export const PHYSICAL_FOCUS = [
  'Full body', 'Core', 'Back', 'Lower back', 'Upper back', 'Shoulders', 'Arms', 'Wrists',
  'Chest', 'Hips', 'Hip flexors', 'Glutes', 'Hamstrings', 'Quadriceps', 'Legs', 'Ankles', 'Feet', 'Neck',
] as const

export const OBJECTIVES = [
  'Strength', 'Flexibility', 'Mobility', 'Balance', 'Stability', 'Recovery', 'Relaxation',
  'Posture', 'Stress reduction', 'Energy', 'Coordination', 'Mindfulness',
] as const

export const ENERGY = ['Energising', 'Grounding', 'Calming', 'Restorative', 'Focused', 'Playful', 'Meditative'] as const

export const EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced', 'All levels'] as const

export const TIME_OF_DAY = ['Morning', 'Midday', 'Evening', 'Before bed', 'Any time'] as const

export const EQUIPMENT = ['Mat only', 'Blocks', 'Strap', 'Blanket', 'Bolster', 'Other equipment'] as const

export const SERIES_KINDS = ['Official YWA series', 'Monthly calendar', 'Challenge', 'Special collection', 'Other programme'] as const

export const DEFAULT_INSTRUCTOR = 'Yoga With Adriene'

/** Duration buckets, in whole minutes. `max` is exclusive except for the last open bucket. */
export const DURATION_BUCKETS = [
  { id: 'lt10', label: 'Under 10 min', min: 0, max: 10 },
  { id: '10-15', label: '10–15 min', min: 10, max: 15 },
  { id: '15-20', label: '15–20 min', min: 15, max: 20 },
  { id: '20-30', label: '20–30 min', min: 20, max: 30 },
  { id: '30-45', label: '30–45 min', min: 30, max: 45 },
  { id: '45-60', label: '45–60 min', min: 45, max: 60 },
  { id: 'gt60', label: 'Over 60 min', min: 60, max: Infinity },
] as const

export type DurationBucketId = (typeof DURATION_BUCKETS)[number]['id']

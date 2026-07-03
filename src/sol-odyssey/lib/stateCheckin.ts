// State check-in: a private, on-device-only moment to notice what's here before you act. Pure
// logic + fixed option data only — no Notion, no network, nothing persisted. The component that
// renders this never writes its selections anywhere; they exist only for the moment they're made.

export const STATE_WORDS = [
  'Calm',
  'Content',
  'Tired',
  'Flat',
  'Restless',
  'Anxious',
  'Frustrated',
  'Overwhelmed',
  'Sad',
  'Irritable',
  'Energized',
  'Hopeful',
] as const
export type StateWord = (typeof STATE_WORDS)[number]

export const INTENSITY_LEVELS = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Noticeable' },
  { value: 'strong', label: 'Strong' },
] as const
export type Intensity = (typeof INTENSITY_LEVELS)[number]['value']

export interface StateCheckinSelection {
  named: StateWord | null
  intensity: Intensity | null
  desired: StateWord | null
}

export const EMPTY_STATE_CHECKIN_SELECTION: StateCheckinSelection = {
  named: null,
  intensity: null,
  desired: null,
}

/** The closing line once both a current and a desired state are chosen — null until then, so the
 *  component can hide it entirely. */
export function closingLine(selection: StateCheckinSelection): string | null {
  if (!selection.named || !selection.desired) return null
  if (selection.named === selection.desired) {
    return `Already there — let ${selection.desired.toLowerCase()} settle in.`
  }
  return `Named: ${selection.named.toLowerCase()}. Choosing: ${selection.desired.toLowerCase()} — let your thoughts and body follow.`
}

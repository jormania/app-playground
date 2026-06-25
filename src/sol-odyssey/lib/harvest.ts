// Harvest: closing one Odyssey and pointing the machine at the next. Day 42 isn't an ending —
// it's a handover. Pure logic only; the screen + write live elsewhere.

export type Outcome = 'Keep' | 'Grow' | 'Retire'

export interface OutcomeOption {
  value: Outcome
  title: string
  description: string
}

export const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    value: 'Keep',
    title: 'Keep',
    description: 'Hold it at the tiny floor as maintenance — installed, low-effort, kept alive.',
  },
  {
    value: 'Grow',
    title: 'Grow',
    description: 'Carry it into a larger version next cycle — this Odyssey is complete.',
  },
  {
    value: 'Retire',
    title: 'Retire',
    description: 'It served its purpose — let it go and choose something new.',
  },
]

/** The Status an Odyssey takes once harvested. Keep → Maintenance (no longer counts as Active, so
 *  a new Odyssey can start); Grow → Completed; Retire → Retired. */
export function statusForOutcome(outcome: Outcome): 'Maintenance' | 'Completed' | 'Retired' {
  switch (outcome) {
    case 'Keep':
      return 'Maintenance'
    case 'Grow':
      return 'Completed'
    case 'Retire':
      return 'Retired'
  }
}

function richText(value: string): { rich_text: { text: { content: string } }[] } {
  const v = value.trim()
  return { rich_text: v ? [{ text: { content: v } }] : [] }
}

/** The Notion properties patched onto the Odyssey at harvest. */
export function buildHarvestProperties(outcome: Outcome, verdict: string): Record<string, unknown> {
  return {
    Outcome: { select: { name: outcome } },
    Status: { select: { name: statusForOutcome(outcome) } },
    Notes: richText(verdict),
  }
}

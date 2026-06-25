import { describe, it, expect } from 'vitest'
import { buildHarvestProperties, statusForOutcome } from './harvest'

describe('statusForOutcome', () => {
  it('maps each outcome to the right Status', () => {
    expect(statusForOutcome('Keep')).toBe('Maintenance')
    expect(statusForOutcome('Grow')).toBe('Completed')
    expect(statusForOutcome('Retire')).toBe('Retired')
  })
})

describe('buildHarvestProperties', () => {
  it('sets Outcome, the mapped Status, and the verdict in Notes', () => {
    const props = buildHarvestProperties('Keep', 'feels automatic now') as Record<string, any>
    expect(props['Outcome'].select.name).toBe('Keep')
    expect(props['Status'].select.name).toBe('Maintenance')
    expect(props['Notes'].rich_text[0].text.content).toBe('feels automatic now')
  })

  it('writes an empty Notes rich_text when no verdict is given', () => {
    const props = buildHarvestProperties('Retire', '   ') as Record<string, any>
    expect(props['Status'].select.name).toBe('Retired')
    expect(props['Notes'].rich_text).toEqual([])
  })
})

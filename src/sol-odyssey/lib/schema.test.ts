import { describe, it, expect } from 'vitest'
import { validateSchema, EXPECTED_SCHEMA } from './schema'

/** A correct properties map for a db key (name → { type }). */
function goodProps(key: 'odysseys' | 'checkins' | 'reflections') {
  return Object.fromEntries(Object.entries(EXPECTED_SCHEMA[key]).map(([name, type]) => [name, { type }]))
}

describe('validateSchema', () => {
  it('reports no issues for a fully-correct database', () => {
    expect(validateSchema('checkins', goodProps('checkins'))).toEqual([])
  })

  it('flags a missing property with its expected type and db label', () => {
    const props = goodProps('checkins')
    delete (props as Record<string, unknown>)['Logged Late']
    const issues = validateSchema('checkins', props)
    expect(issues).toEqual([{ db: 'Check-ins', property: 'Logged Late', expectedType: 'checkbox' }])
  })

  it('flags a wrong-type property, carrying the actual type', () => {
    const props = goodProps('odysseys')
    props['Status'] = { type: 'rich_text' }
    const issues = validateSchema('odysseys', props)
    expect(issues).toContainEqual({ db: 'Odysseys', property: 'Status', expectedType: 'select', actualType: 'rich_text' })
  })
})

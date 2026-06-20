import { test, expect, describe } from 'vitest'
import { getActiveMoments, getMomentByKey } from './moments.js'

const keys = (date, phase) => getActiveMoments(date, phase).map(m => m.key)

describe('getActiveMoments', () => {
  test('summer solstice on Jun 21', () => {
    expect(keys(new Date(2024, 5, 21))).toContain('summer-solstice')
  })
  test('Perseids around Aug 12 (with window)', () => {
    expect(keys(new Date(2024, 7, 11))).toContain('perseids')
    expect(keys(new Date(2024, 7, 13))).toContain('perseids')
  })
  test('Samhain on Oct 31 and Nov 1', () => {
    expect(keys(new Date(2024, 9, 31))).toContain('samhain')
    expect(keys(new Date(2024, 10, 1))).toContain('samhain')
  })
  test('zodiac ingress fires on a boundary day', () => {
    expect(keys(new Date(2024, 6, 23))).toContain('ingress-leo')
  })
  test('full moon when phase ~0.5', () => {
    expect(keys(new Date(2024, 4, 15), 0.5)).toContain('full-moon')
  })
  test('new moon when phase ~0', () => {
    expect(keys(new Date(2024, 4, 15), 0.0)).toContain('new-moon')
  })
  test('an ordinary day with no events is empty', () => {
    expect(keys(new Date(2024, 5, 10), 0.3)).toHaveLength(0)
  })
  test('meteor moments carry the meteor flag', () => {
    const perseids = getActiveMoments(new Date(2024, 7, 12)).find(m => m.key === 'perseids')
    expect(perseids.meteor).toBe(true)
  })
})

describe('getMomentByKey', () => {
  test('known fixed key', () => expect(getMomentByKey('geminids').name).toBe('the Geminids'))
  test('full-moon', () => expect(getMomentByKey('full-moon').key).toBe('full-moon'))
  test('unknown returns null', () => expect(getMomentByKey('nope')).toBe(null))
})

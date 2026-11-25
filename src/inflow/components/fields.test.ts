import { describe, expect, it } from 'vitest'
import { parseAmount, parseRate } from './fields'

describe('parseAmount reads amounts as people type them', () => {
  it.each([
    ['1500', 1500], ['1.500', 1500], ['1,500', 1500], ['1 500', 1500], ['1 500', 1500],
    ['12.345', 12345], ['1.234.567', 1234567], ['1,234,567', 1234567],
    ['1,5', 1.5], ['1.5', 1.5], ['12.50', 12.5], ['12,50', 12.5], ['0,125', 0.125], ['0.125', 0.125],
    ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['', 0], ['  ', 0],
  ])('%s → %s', (input, want) => expect(parseAmount(input)).toBe(want))
  it('says when it is not a number', () => {
    expect(parseAmount('abc')).toBeNaN()
    expect(parseAmount('1.2.x')).toBeNaN()
  })
})

describe('parseRate keeps exchange rates as decimals', () => {
  it.each([['4.976', 4.976], ['4,976', 4.976], ['5.0912', 5.0912], ['5', 5], ['', 0]])('%s → %s', (input, want) => expect(parseRate(input)).toBe(want))
})

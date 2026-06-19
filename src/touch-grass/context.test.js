import { test, expect, describe } from 'vitest'
import { getTimeOfDay, getSeason } from './context.js'

function dateAt(hour, month = 5) {
  const d = new Date(2024, month, 15)
  d.setHours(hour, 0, 0, 0)
  return d
}

function dateInMonth(month) {
  return new Date(2024, month, 15)
}

describe('getTimeOfDay — summer (June)', () => {
  // summer: dawn 5–7:30, day 7:30–20:30, dusk 20:30–22:30, night otherwise
  test('4am is night',     () => expect(getTimeOfDay(dateAt(4))).toBe('night'))
  test('5am is dawn',      () => expect(getTimeOfDay(dateAt(5))).toBe('dawn'))
  test('7am is dawn',      () => expect(getTimeOfDay(dateAt(7))).toBe('dawn'))
  test('8am is day',       () => expect(getTimeOfDay(dateAt(8))).toBe('day'))
  test('noon is day',      () => expect(getTimeOfDay(dateAt(12))).toBe('day'))
  test('7pm is day',       () => expect(getTimeOfDay(dateAt(19))).toBe('day'))
  test('8pm is day',       () => expect(getTimeOfDay(dateAt(20))).toBe('day'))
  test('9pm is dusk',      () => expect(getTimeOfDay(dateAt(21))).toBe('dusk'))
  test('11pm is night',    () => expect(getTimeOfDay(dateAt(23))).toBe('night'))
  test('midnight is night',() => expect(getTimeOfDay(dateAt(0))).toBe('night'))
})

describe('getTimeOfDay — winter (January)', () => {
  // winter: dawn 7–9, day 9–16, dusk 16–18, night otherwise
  test('6am is night',  () => expect(getTimeOfDay(dateAt(6, 0))).toBe('night'))
  test('7am is dawn',   () => expect(getTimeOfDay(dateAt(7, 0))).toBe('dawn'))
  test('9am is day',    () => expect(getTimeOfDay(dateAt(9, 0))).toBe('day'))
  test('noon is day',   () => expect(getTimeOfDay(dateAt(12, 0))).toBe('day'))
  test('4pm is dusk',   () => expect(getTimeOfDay(dateAt(16, 0))).toBe('dusk'))
  test('6pm is night',  () => expect(getTimeOfDay(dateAt(18, 0))).toBe('night'))
})

describe('getTimeOfDay — autumn (October)', () => {
  // autumn: dawn 6–8, day 8–18:30, dusk 18:30–20:30, night otherwise
  test('5am is night',  () => expect(getTimeOfDay(dateAt(5, 9))).toBe('night'))
  test('6am is dawn',   () => expect(getTimeOfDay(dateAt(6, 9))).toBe('dawn'))
  test('8am is day',    () => expect(getTimeOfDay(dateAt(8, 9))).toBe('day'))
  test('6pm is day',    () => expect(getTimeOfDay(dateAt(18, 9))).toBe('day'))
  test('9pm is night',  () => expect(getTimeOfDay(dateAt(21, 9))).toBe('night'))
})

describe('getSeason', () => {
  test('January is winter',   () => expect(getSeason(dateInMonth(0))).toBe('winter'))
  test('February is winter',  () => expect(getSeason(dateInMonth(1))).toBe('winter'))
  test('March is spring',     () => expect(getSeason(dateInMonth(2))).toBe('spring'))
  test('May is spring',       () => expect(getSeason(dateInMonth(4))).toBe('spring'))
  test('June is summer',      () => expect(getSeason(dateInMonth(5))).toBe('summer'))
  test('August is summer',    () => expect(getSeason(dateInMonth(7))).toBe('summer'))
  test('September is autumn', () => expect(getSeason(dateInMonth(8))).toBe('autumn'))
  test('November is autumn',  () => expect(getSeason(dateInMonth(10))).toBe('autumn'))
  test('December is winter',  () => expect(getSeason(dateInMonth(11))).toBe('winter'))
})

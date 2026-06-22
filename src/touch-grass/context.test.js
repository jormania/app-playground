import { test, expect, describe } from 'vitest'
import { getTimeOfDay, getSeason, getMoonPhase, getLight, getSunAltitude, getNextSunAnchor, moonPhaseName, daysToFullMoon } from './context.js'

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

describe('getTimeOfDay — with coordinates (SunCalc)', () => {
  const bucharest = { lat: 44.43, lon: 26.10 }
  test('summer noon is day', () => {
    const d = new Date('2024-06-21T12:00:00')
    expect(getTimeOfDay(d, bucharest)).toBe('day')
  })
  test('summer 3am is night', () => {
    const d = new Date('2024-06-21T03:00:00')
    expect(getTimeOfDay(d, bucharest)).toBe('night')
  })
  test('returns a valid bucket for any hour', () => {
    const buckets = ['dawn', 'day', 'dusk', 'night']
    for (let h = 0; h < 24; h++) {
      const d = new Date('2024-06-21T00:00:00')
      d.setHours(h)
      expect(buckets).toContain(getTimeOfDay(d, bucharest))
    }
  })
})

describe('getMoonPhase', () => {
  test('returns phase in [0,1) and fraction in [0,1]', () => {
    const { phase, fraction } = getMoonPhase(new Date('2024-06-21T22:00:00'))
    expect(phase).toBeGreaterThanOrEqual(0)
    expect(phase).toBeLessThan(1)
    expect(fraction).toBeGreaterThanOrEqual(0)
    expect(fraction).toBeLessThanOrEqual(1)
  })
  test('a known full moon is near fraction 1', () => {
    // 2024-06-22 was a full moon
    const { fraction } = getMoonPhase(new Date('2024-06-22T01:00:00Z'))
    expect(fraction).toBeGreaterThan(0.9)
  })
})

describe('moonPhaseName', () => {
  test('the four cardinal phases land on their names', () => {
    expect(moonPhaseName(0)).toBe('new moon')
    expect(moonPhaseName(0.25)).toBe('first quarter')
    expect(moonPhaseName(0.5)).toBe('full moon')
    expect(moonPhaseName(0.75)).toBe('last quarter')
  })
  test('the between phases wax and wane correctly', () => {
    expect(moonPhaseName(0.12)).toBe('waxing crescent')
    expect(moonPhaseName(0.37)).toBe('waxing gibbous')
    expect(moonPhaseName(0.62)).toBe('waning gibbous')
    expect(moonPhaseName(0.88)).toBe('waning crescent')
  })
  test('wraps around 1 back to new moon', () => {
    expect(moonPhaseName(0.999)).toBe('new moon')
    expect(moonPhaseName(1)).toBe('new moon')
  })
})

describe('daysToFullMoon', () => {
  test('zero at full moon', () => {
    expect(daysToFullMoon(0.5)).toBeCloseTo(0, 5)
  })
  test('about half a synodic month from new moon', () => {
    expect(daysToFullMoon(0)).toBeCloseTo(14.77, 1)
  })
  test('just past full wraps toward the next full (~29 days)', () => {
    expect(daysToFullMoon(0.51)).toBeGreaterThan(28)
    expect(daysToFullMoon(0.51)).toBeLessThan(30)
  })
  test('always non-negative and within one synodic month', () => {
    for (const p of [0, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75, 0.99]) {
      const d = daysToFullMoon(p)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(29.54)
    }
  })
})


describe('getLight — golden / blue hour', () => {
  const equator = { lat: 0, lon: 0 }
  test('is flat without coordinates', () => {
    expect(getLight(new Date(), null)).toEqual({ golden: 0, blue: 0 })
    expect(getLight(new Date(), { lat: 'x' })).toEqual({ golden: 0, blue: 0 })
  })
  test('strengths stay within 0..1', () => {
    for (const h of [0, 6, 12, 18, 21]) {
      const { golden, blue } = getLight(new Date(Date.UTC(2026, 2, 20, h)), equator)
      expect(golden).toBeGreaterThanOrEqual(0); expect(golden).toBeLessThanOrEqual(1)
      expect(blue).toBeGreaterThanOrEqual(0);   expect(blue).toBeLessThanOrEqual(1)
    }
  })
  test('flat and dark at solar midnight', () => {
    expect(getSunAltitude(new Date(Date.UTC(2026, 2, 20, 0)), equator)).toBeLessThan(-10)
    expect(getLight(new Date(Date.UTC(2026, 2, 20, 0)), equator)).toEqual({ golden: 0, blue: 0 })
  })
  test('flat at high noon (sun above the golden band)', () => {
    expect(getSunAltitude(new Date(Date.UTC(2026, 2, 20, 12)), equator)).toBeGreaterThan(60)
    expect(getLight(new Date(Date.UTC(2026, 2, 20, 12)), equator)).toEqual({ golden: 0, blue: 0 })
  })
  test('reaches a golden peak somewhere in the day', () => {
    let peak = 0
    for (let m = 0; m < 24 * 60; m += 1) {
      peak = Math.max(peak, getLight(new Date(Date.UTC(2026, 2, 20, 0, m)), equator).golden)
    }
    expect(peak).toBeGreaterThan(0.5)
  })
  test('reaches a blue-hour peak somewhere in the day', () => {
    let peak = 0
    for (let m = 0; m < 24 * 60; m += 1) {
      peak = Math.max(peak, getLight(new Date(Date.UTC(2026, 2, 20, 0, m)), equator).blue)
    }
    expect(peak).toBeGreaterThan(0.3)
  })
})

describe('getNextSunAnchor', () => {
  const equator = { lat: 0, lon: 0 } // equator: sunrise ~06:00, noon ~12:00, sunset ~18:00 UTC
  const utc = (h) => new Date(Date.UTC(2026, 5, 21, h))

  test('always points to a turn that is ahead and within ~14h', () => {
    // the regression guard: just-after-midnight must not return a 23h-away anchor
    for (let h = 0; h < 24; h++) {
      const d = utc(h)
      const dt = getNextSunAnchor(d, equator).at.getTime() - d.getTime()
      expect(dt).toBeGreaterThan(0)
      expect(dt).toBeLessThanOrEqual(14 * 3600 * 1000)
    }
  })

  test('after midnight, before sunrise, points to sunrise', () => {
    expect(getNextSunAnchor(utc(2), equator).key).toBe('sunrise')
  })

  test('mid-morning points to noon', () => {
    expect(getNextSunAnchor(utc(10), equator).key).toBe('noon')
  })

  test('without coords, falls back to clock noon / midnight', () => {
    expect(getNextSunAnchor(new Date(2026, 5, 21, 9, 0), null).key).toBe('noon')
    expect(getNextSunAnchor(new Date(2026, 5, 21, 15, 0), null).key).toBe('midnight')
  })
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

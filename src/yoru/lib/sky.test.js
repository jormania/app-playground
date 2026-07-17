import { describe, it, expect } from 'vitest'
import {
  skyToScreen,
  twilight,
  starPosition,
  meteorShower,
  dayOfYear,
  extinction,
  moonBrightLimb,
  moonPhase,
  moonBrief,
  moonGlyphPath,
  nextMoonrise,
  moonPosition,
} from './sky'

// Bucharest, and a latitude in the south for the hemisphere checks.
const HERE = { lat: 44.43, lon: 26.1 }
const SOUTH = { lat: -33.9, lon: 151.2 }

describe('skyToScreen', () => {
  // The frame is a view FACING SOUTH — the framing the moon's arc already
  // commits to by running rise (east) on the left to set (west) on the right.
  // These guard the azimuth sign: suncalc 2 measures azimuth north-based
  // clockwise, and the expression here was originally written for 1.x's
  // south-based convention, which mirrored the whole sky east-for-west.
  it('puts east left of centre and west right of centre', () => {
    expect(skyToScreen({ azimuth: 160, altitude: 30 }).x).toBeLessThan(0.5) // ~SSE
    expect(skyToScreen({ azimuth: 200, altitude: 30 }).x).toBeGreaterThan(0.5) // ~SSW
  })
  it('puts due south dead centre', () => {
    expect(skyToScreen({ azimuth: 180, altitude: 30 }).x).toBeCloseTo(0.5, 6)
  })
  it('rides higher up the frame the higher the altitude', () => {
    const low = skyToScreen({ azimuth: 180, altitude: 2 }).y
    const high = skyToScreen({ azimuth: 180, altitude: 70 }).y
    expect(high).toBeLessThan(low) // y is measured from the top
  })
})

describe('twilight', () => {
  it('glows in the west at dusk and the east at dawn', () => {
    // ~21:00 local, the sun just setting in the WNW
    const dusk = twilight(new Date('2026-07-17T18:00:00Z'), HERE)
    expect(dusk).not.toBeNull()
    expect(dusk.x).toBeGreaterThan(0.5)
    // ~05:40 local, the sun coming up in the NE
    const dawn = twilight(new Date('2026-07-17T02:40:00Z'), HERE)
    expect(dawn).not.toBeNull()
    expect(dawn.x).toBeLessThan(0.5)
  })
  it('is gone in the middle of the night', () => {
    expect(twilight(new Date('2026-07-17T22:00:00Z'), HERE)).toBeNull()
  })
  it('needs a location', () => {
    expect(twilight(new Date('2026-07-17T18:00:00Z'), null)).toBeNull()
  })
})

describe('starPosition', () => {
  // Polaris sits within a degree of the celestial pole, which pins two facts
  // that must hold at every hour of every night: it stands due north, at an
  // altitude equal to your latitude. If the sidereal time, the hour angle or
  // the azimuth convention were wrong, one of these would swing.
  // Polaris is not exactly ON the pole — it's 0.74° off it, and so traces a
  // small circle around it once a day. That's why these allow ±0.8° rather
  // than pinning an exact figure: the residual wobble is the real star's, and
  // seeing it come out at 0.7° is itself a sign the maths is right.
  const POLARIS = [37.95, 89.26]
  const POLAR_DISTANCE = 0.8
  it('holds Polaris due north at altitude = latitude, all night', () => {
    for (const hour of [0, 6, 12, 18]) {
      const p = starPosition(new Date(Date.UTC(2026, 6, 17, hour)), HERE, ...POLARIS)
      expect(Math.abs(p.altitude - HERE.lat)).toBeLessThan(POLAR_DISTANCE)
      expect(Math.min(p.azimuth, 360 - p.azimuth)).toBeLessThan(2) // ~0° or ~360°, i.e. north
    }
  })
  it('puts Polaris below the horizon from the southern hemisphere', () => {
    const p = starPosition(new Date(Date.UTC(2026, 6, 17, 3)), SOUTH, ...POLARIS)
    expect(Math.abs(p.altitude - SOUTH.lat)).toBeLessThan(POLAR_DISTANCE)
    expect(p.altitude).toBeLessThan(0)
  })
  it('culminates due south at 90 - |lat - dec|', () => {
    // scan a full day for the highest point a dec +20 star reaches
    let top = null
    for (let m = 0; m < 1440; m += 2) {
      const p = starPosition(new Date(Date.UTC(2026, 6, 17, 0, m)), HERE, 100, 20)
      if (!top || p.altitude > top.altitude) top = p
    }
    expect(top.altitude).toBeCloseTo(90 - Math.abs(HERE.lat - 20), 0)
    expect(top.azimuth).toBeCloseTo(180, 0)
  })
  it('needs a location', () => {
    expect(starPosition(new Date(), null, ...POLARIS)).toBeNull()
  })
})

describe('meteorShower', () => {
  it('peaks the Perseids in mid-August', () => {
    const r = meteorShower(new Date(2026, 7, 12))
    expect(r.shower.name).toBe('Perseids')
    expect(r.strength).toBeCloseTo(1, 2)
  })
  it('leaves an ordinary night alone', () => {
    expect(meteorShower(new Date(2026, 5, 15))).toBeNull() // mid-June: nothing running
    expect(meteorShower(new Date(2026, 6, 17))).toBeNull()
  })
  it('carries the Quadrantids across New Year', () => {
    // peaks Jan 3, so the back half of its window is the previous December —
    // the case a naive day-of-year gap tears in half
    const dec = meteorShower(new Date(2026, 11, 30))
    expect(dec.shower.name).toBe('Quadrantids')
    expect(dec.strength).toBeGreaterThan(0)
    expect(dec.strength).toBeLessThan(meteorShower(new Date(2026, 0, 3)).strength)
  })
  it('picks the stronger of two overlapping December windows', () => {
    const r = meteorShower(new Date(2026, 11, 14))
    expect(r.shower.name).toBe('Geminids') // not the Ursids, whose window it also sits in
  })
})

describe('dayOfYear', () => {
  it('counts from 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
    expect(dayOfYear(new Date(2026, 7, 12))).toBe(224)
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
  })
})

describe('extinction', () => {
  it('leaves the upper sky alone and fades stars into the horizon', () => {
    expect(extinction(0.1)).toBe(1)
    expect(extinction(0.5)).toBe(1)
    expect(extinction(1)).toBeLessThan(0.5)
    expect(extinction(0.8)).toBeLessThan(extinction(0.7))
  })
})

// Verified against the real sky for this location. HIGH/LOW/DOWN are the three
// cases moonBrief has to tell apart.
const MOON_HIGH = new Date('2026-01-02T22:00:00Z') // 73° up, due south
const MOON_LOW = new Date('2026-07-17T19:00:00Z') // 7.6° up, in the west
const MOON_DOWN = new Date('2026-07-07T20:00:00Z') // 14.9° BELOW the horizon
const MOON_DOWN_LATE = new Date('2026-07-17T23:00:00Z') // 02:00 local, well down

describe('nextMoonrise', () => {
  it('finds a rise in the future that the moon is genuinely down before and up after', () => {
    expect(moonPosition(MOON_DOWN, HERE).altitude).toBeLessThan(0)
    const rise = nextMoonrise(MOON_DOWN, HERE)
    expect(rise).not.toBeNull()
    expect(rise.at).toBeGreaterThan(MOON_DOWN.getTime())
    expect(moonPosition(new Date(rise.at - 10 * 60000), HERE).altitude).toBeLessThan(0)
    expect(moonPosition(new Date(rise.at + 20 * 60000), HERE).altitude).toBeGreaterThan(0)
  })
  it('rises in the eastern half of the sky, as everything up there does', () => {
    const rise = nextMoonrise(MOON_DOWN, HERE)
    expect(rise.azimuth).toBeGreaterThan(20) // north-based: east is 0..180
    expect(rise.azimuth).toBeLessThan(160)
  })
  it('looks FORWARD, unlike moonArc, which resolves the window nearest now', () => {
    // The distinction that matters: once the moon has set, the interesting
    // question is the next rise, not the last one.
    const rise = nextMoonrise(MOON_LOW, HERE) // moon is UP here, so the next rise is a day off
    expect(rise.at).toBeGreaterThan(MOON_LOW.getTime())
  })
  it('needs a location', () => {
    expect(nextMoonrise(new Date(), null)).toBeNull()
  })
})

describe('moonBrief', () => {
  it('says where the moon is when it is up, and says nothing about rising', () => {
    expect(moonBrief(MOON_HIGH, HERE)).toBe('waxing gibbous · high in the south')
    expect(moonBrief(MOON_LOW, HERE)).toBe('waxing crescent · low in the west')
  })
  it('drops the height word for a moon at no particular height', () => {
    // 16° up — neither low nor high, so it just says where
    expect(moonBrief(new Date('2026-07-29T20:00:00Z'), HERE)).toBe('full moon · in the south-east')
  })
  it('says when and where it is due when the moon is down', () => {
    expect(moonBrief(MOON_DOWN, HERE)).toBe('last quarter · rises tonight around 00:30, in the east')
  })
  it("counts the small hours as tonight, by Yoru's 4am night, not the calendar's midnight", () => {
    // MOON_DOWN is 23:00 local: a rise at 00:30 is still "tonight" to anyone
    // awake for it, though the calendar has already turned over.
    expect(moonBrief(MOON_DOWN, HERE)).toContain('rises tonight')
    // MOON_DOWN_LATE is 02:00 local — still the same Yoru night — so a rise the
    // following morning is properly "tomorrow".
    expect(moonBrief(MOON_DOWN_LATE, HERE)).toContain('rises tomorrow')
  })
  it('keeps the time approximate — never to the minute', () => {
    for (const at of [MOON_DOWN, MOON_DOWN_LATE]) {
      const time = moonBrief(at, HERE).match(/around (\S+?),/)[1]
      expect(time === 'midnight' || /^\d{2}:(00|30)$/.test(time)).toBe(true)
    }
  })
  it('names the phase and nothing more without a location — the phase is all we honestly know', () => {
    expect(moonBrief(MOON_HIGH, null)).toBe('waxing gibbous')
    expect(moonBrief(MOON_DOWN, null)).toBe('last quarter')
  })
})

describe('moonGlyphPath', () => {
  it('draws nothing at new moon — there is genuinely no lit face', () => {
    expect(moonGlyphPath(0)).toBe('')
    expect(moonGlyphPath(1)).toBe('')
  })
  it('closes to a plain full disc at full moon, with no case for it', () => {
    // the terminator's radius has grown to the whole disc, so the two arcs meet
    // as a circle and nothing is bitten out of it
    expect(moonGlyphPath(0.5)).toBe('M 0 -1 A 1 1 0 0 1 0 1 A 1.0000 1 0 0 1 0 -1 Z')
  })
  it('draws a straight terminator at the quarters', () => {
    // radius 0 — SVG renders a zero-radius arc as a straight line, which is
    // exactly what a half-lit moon's edge is
    expect(moonGlyphPath(0.25)).toContain('A 0.0000 1 ')
    expect(moonGlyphPath(0.75)).toContain('A 0.0000 1 ')
  })
  it('mirrors a waxing crescent against a waning one', () => {
    // same sliver of light, opposite limb: sweep 1 (the right half, clockwise)
    // waxing, sweep 0 (the left) waning
    expect(moonGlyphPath(0.125).startsWith('M 0 -1 A 1 1 0 0 1 0 1')).toBe(true)
    expect(moonGlyphPath(0.875).startsWith('M 0 -1 A 1 1 0 0 0 0 1')).toBe(true)
  })
  it('bulges the terminator the other way once past a quarter', () => {
    // crescent: the terminator curves toward the lit limb; gibbous: away from it
    const crescent = moonGlyphPath(0.125).split('A')[2].trim()
    const gibbous = moonGlyphPath(0.375).split('A')[2].trim()
    expect(crescent.split(' ')[4]).toBe('0') // sweep
    expect(gibbous.split(' ')[4]).toBe('1')
  })
})

describe('moonBrightLimb', () => {
  it('needs a location — the parallactic angle has nowhere to come from without one', () => {
    expect(moonBrightLimb(new Date(), null)).toBeNull()
    expect(moonBrightLimb(new Date(), { lat: 44 })).toBeNull()
  })
  it('points the lit edge toward the sun, and turns as the night goes on', () => {
    // A waxing crescent low in the west after sunset: the sun is below the
    // horizon and off to its right, so the bright limb must point right and
    // down — i.e. somewhere past a quarter-turn clockwise from straight up,
    // which in this counter-clockwise-positive convention is a good way
    // negative. (Verified against the real sky for this date.)
    const chi = moonBrightLimb(new Date('2026-07-20T20:00:00Z'), HERE)
    const deg = (chi * 180) / Math.PI
    expect(moonPhase(new Date('2026-07-20T20:00:00Z')).phase).toBeLessThan(0.5) // waxing
    expect(deg).toBeLessThan(-90)
    expect(deg).toBeGreaterThan(-150)
  })
  it('leans the other way for a waning moon before dawn', () => {
    const chi = moonBrightLimb(new Date('2026-07-07T20:00:00Z'), HERE)
    expect((chi * 180) / Math.PI).toBeGreaterThan(90) // mirrored: lit edge to the left
  })
})

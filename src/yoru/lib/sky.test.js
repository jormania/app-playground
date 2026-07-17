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

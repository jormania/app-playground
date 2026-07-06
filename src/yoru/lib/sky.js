import { getMoonIllumination, getMoonPosition } from 'suncalc'

// Real lunar data for Yoru's "Go dark" sky. The moon's PHASE is the same the
// world over at a given instant; its POSITION (whether it's up, and where) is
// location-based, so we use coordinates when the user grants them.

// { fraction: illuminated 0..1, phase: 0=new .5=full 1=new } — always available.
export function moonPhase(date = new Date()) {
  const m = getMoonIllumination(date)
  return { fraction: m.fraction, phase: m.phase }
}

// { altitude (rad, >0 = above horizon), azimuth (rad) } or null without coords.
// Guarded because SunCalc's horizontal transform can return non-finite values.
export function moonPosition(date, coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  try {
    const p = getMoonPosition(date, coords.lat, coords.lon)
    if (!Number.isFinite(p.altitude) || !Number.isFinite(p.azimuth)) return null
    return { altitude: p.altitude, azimuth: p.azimuth }
  } catch {
    return null
  }
}

// Where to place the moon on screen (fractions 0..1, y measured from the top),
// plus how present it is. With a location we honour the real altitude/azimuth:
// a high moon rides higher and brighter; a moon below the horizon sits low and
// dim. Without a location we place a gentle moon low on the right.
export function moonPlacement(pos) {
  if (!pos) return { x: 0.72, y: 0.8, presence: 0.85 }
  const altDeg = (pos.altitude * 180) / Math.PI
  // azimuth: SunCalc measures from south, + toward west. Map to a screen x.
  const az = pos.azimuth
  const x = 0.5 + 0.42 * Math.sin(az)
  if (altDeg <= 0) {
    // below the horizon — a faint moon resting near the bottom edge
    return { x: Math.min(0.86, Math.max(0.14, x)), y: 0.9, presence: 0.4 }
  }
  const up = Math.min(1, altDeg / 60) // 0 at horizon → 1 near overhead
  return {
    x: Math.min(0.86, Math.max(0.14, x)),
    y: 0.72 - 0.5 * up, // higher altitude → higher in the frame
    presence: 0.7 + 0.3 * up,
  }
}

// Draw the moon at its true phase on a 2D canvas context. Deliberately dim: the
// lit face is a soft, low glow and the shadow side is barely perceptible, so it
// never lights a dark room.
export function drawMoon(ctx, cx, cy, r, phase, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha

  // faint halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.4)
  halo.addColorStop(0, 'rgba(190,178,230,0.07)')
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2)
  ctx.fill()

  // dark disc (earthshine) — barely visible, just enough to read as a full disc
  ctx.fillStyle = 'rgba(48,45,68,0.22)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // illuminated part, bounded by the terminator ellipse (standard construction);
  // a muted lilac, not white
  const waxing = phase <= 0.5
  const ellipseW = r * Math.cos(phase * 2 * Math.PI) // signed
  ctx.fillStyle = '#8f88b4'
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing)
  ctx.ellipse(
    cx,
    cy,
    Math.abs(ellipseW),
    r,
    0,
    Math.PI / 2,
    -Math.PI / 2,
    ellipseW > 0 ? waxing : !waxing,
  )
  ctx.fill()

  ctx.restore()
}

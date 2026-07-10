import { getMoonIllumination, getMoonPosition } from 'suncalc'

// Real lunar data for Yoru's "Go dark" sky. The moon's PHASE is the same the
// world over at a given instant; its POSITION (whether it's up, and where) is
// location-based, so we use coordinates when the user grants them.

// { fraction: illuminated 0..1, phase: 0=new .5=full 1=new } — always available.
export function moonPhase(date = new Date()) {
  const m = getMoonIllumination(date)
  return { fraction: m.fraction, phase: m.phase }
}

// { altitude (deg, >0 = above horizon), azimuth (deg) } or null without coords.
// NOTE: this installed suncalc (2.x) returns both already in DEGREES — its own
// source converts internally (`/ rad`, where `rad = PI/180`) before returning.
// That's a change from the classic 1.x API (radians), which is what the rest of
// this file used to assume; treating degrees as radians made every downstream
// calculation (the altitude threshold, and worse, azimuth fed straight into
// Math.sin/cos) come out essentially arbitrary. Guarded for non-finite values.
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
//
// Margins are deliberately generous on every side — well clear of the left,
// right, top AND bottom edges (the halo alone reaches ~2.6× the moon's own
// radius, so a tight clamp would let it clip the frame; a phone's notch/status
// bar also lives up top). The moon should always read as floating IN the sky,
// never touching its border.
const MARGIN_X = 0.24
const MARGIN_TOP = 0.28
const MARGIN_BOTTOM = 0.2

export function moonPlacement(pos) {
  const clampX = (x) => Math.min(1 - MARGIN_X, Math.max(MARGIN_X, x))
  if (!pos) return { x: clampX(0.72), y: 1 - MARGIN_BOTTOM - 0.06, presence: 0.85 }
  const altDeg = pos.altitude // already degrees
  // azimuth: SunCalc measures from south, + toward west, in degrees — convert
  // to radians before using it in a trig function.
  const az = (pos.azimuth * Math.PI) / 180
  const x = 0.5 + 0.42 * Math.sin(az)
  if (altDeg <= 0) {
    // below the horizon — genuinely not up yet (or already set), so it's not
    // visible at all. No dim placeholder: strict realism, matched to the real
    // moonrise/moonset moment rather than a fixed "always some glow" look.
    return { x: clampX(x), y: 1 - MARGIN_BOTTOM, presence: 0 }
  }
  const up = Math.min(1, altDeg / 60) // 0 at horizon → 1 near overhead
  const yLow = 1 - MARGIN_BOTTOM - 0.12 // just above the "below horizon" resting spot
  const yHigh = MARGIN_TOP
  return {
    x: clampX(x),
    y: yLow - (yLow - yHigh) * up, // higher altitude → higher in the frame
    presence: 0.7 + 0.3 * up,
  }
}

// ── Moon transition trail ────────────────────────────────────────────────
// A dotted trail either side of "now" — where the moon was, and where it's
// headed — built from the same real placement the moon itself uses, so it
// always passes exactly through the rendered moon. Deliberately a short
// breadcrumb (a few hours), not the whole night: azimuth sweeps past ±90°
// over a full transit, and since x is mapped from sin(azimuth) (see
// moonPlacement), that means x eventually folds back on itself — harmless for
// a single dot, but it would visibly cross itself in a trail. Each side stops
// the instant it would double back, so the assembled trail is always one
// continuous, non-overlapping sweep from left to right.
const TRAIL_STEP_MIN = 5
const TRAIL_MAX_HOURS = 4

export function moonPath(date, coords) {
  if (!coords) return null
  const stepMs = TRAIL_STEP_MIN * 60 * 1000
  const maxSteps = Math.round((TRAIL_MAX_HOURS * 60) / TRAIL_STEP_MIN)

  const at = (offsetMs) => {
    const pos = moonPosition(new Date(date.getTime() + offsetMs), coords)
    return pos ? moonPlacement(pos) : null
  }

  const now = at(0)
  if (!now || now.presence <= 0) return null

  // Which way x is currently moving, so both sides extend consistently with
  // it (and so we can tell "doubled back" from "still advancing").
  const probe = at(stepMs)
  const dir = probe && probe.x !== now.x ? Math.sign(probe.x - now.x) : 1

  const past = []
  let prevX = now.x
  for (let i = 1; i <= maxSteps; i++) {
    const p = at(-i * stepMs)
    if (!p || p.presence <= 0 || (p.x - prevX) * dir > 0) break
    past.unshift(p)
    prevX = p.x
  }

  const future = []
  prevX = now.x
  for (let i = 1; i <= maxSteps; i++) {
    const p = at(i * stepMs)
    if (!p || p.presence <= 0 || (p.x - prevX) * dir < 0) break
    future.push(p)
    prevX = p.x
  }

  const points = [...past, now, ...future]
  return points.length > 1 ? { points, nowIndex: past.length } : null
}

// Dim dots tracing the trail (the moon itself already marks "now", so that
// point is skipped), fading toward both ends but staying clearly readable —
// dim enough to belong in this sky, bright enough to actually see against it.
export function drawMoonPath(ctx, path, w, h) {
  if (!path) return
  const { points, nowIndex } = path
  const span = Math.max(points.length - 1, 1)
  for (let i = 0; i < points.length; i++) {
    if (i === nowIndex) continue
    const p = points[i]
    const dist = Math.abs(i - nowIndex) / span
    const alpha = 0.4 * (1 - dist * 0.5) * p.presence
    if (alpha <= 0) continue
    ctx.fillStyle = `rgba(198,197,224,${alpha})`
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 1.7, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Real star colours & sizes ────────────────────────────────────────────
// Real stars span the blackbody range (spectral classes O through M) — hot
// blue-white through to cool orange-red — and true brightness follows a
// steep curve: most stars are faint pinpricks, a rare few stand out. Shared
// by the ordinary star field and the Milky Way's speckle texture, so the
// whole sky reads as one consistent population, not two different palettes.
const STAR_PALETTE = [
  { c: [170, 191, 255], w: 0.06 }, // O/B — blue-white, rare
  { c: [202, 215, 255], w: 0.16 }, // A — white with a cool cast
  { c: [244, 246, 255], w: 0.3 }, // F — near white
  { c: [255, 244, 234], w: 0.28 }, // G — warm white (Sun-like)
  { c: [255, 214, 170], w: 0.14 }, // K — pale orange
  { c: [255, 181, 128], w: 0.06 }, // M — orange-red, rare
]
export function starColor() {
  const r = Math.random()
  let acc = 0
  for (const s of STAR_PALETTE) {
    acc += s.w
    if (r <= acc) return s.c
  }
  return STAR_PALETTE[STAR_PALETTE.length - 1].c
}
export function starSize() {
  return 0.3 + Math.random() ** 3.2 * 1.7 // steep falloff — bright/big ones are rare
}

// ── Milky Way ────────────────────────────────────────────────────────────
// The sky's main "space filler": a wispy band arching across a large diagonal
// span of the frame — a fixed, sensible angle and position (only lightly
// randomised) so it always reads as one real arc crossing the whole sky,
// never as a patch floating in the middle. Built from two layers:
//   1. A wispy glow — many overlapping soft patches of varying width and
//      density along the band, composited with 'lighten' so overlaps take the
//      brighter value rather than summing (summing double-darkens every
//      overlap into visible blotches — the single failure mode to avoid here).
//      Deliberately dim throughout: this must never compete with the moon.
//   2. A scatter of countless tiny, realistically coloured speckle stars
//      within the glow, denser toward the core — the actual "filling" texture.
export function makeMilkyWay(w, h) {
  const angle = -1.15 + (Math.random() - 0.5) * 0.1 // a steep, consistent diagonal
  const cx = w * 0.5
  const cy = h * 0.4
  const length = Math.max(w, h) * 2.05 // runs off both edges — a real arc, not a patch
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)

  const glow = []
  const SEG_N = 50
  for (let i = 0; i < SEG_N; i++) {
    const t = (i / (SEG_N - 1) - 0.5) * length
    const core = Math.exp(-((t / (length * 0.36)) ** 2))
    const density = core * (0.5 + Math.random() * 0.75) // patchy, not uniform
    if (density < 0.05) continue
    const along = t + (Math.random() - 0.5) * (length / SEG_N) * 0.9
    const perp = (Math.random() - 0.5) * Math.min(w, h) * 0.06
    const x = cx + dx * along - dy * perp
    const y = cy + dy * along + dx * perp
    const halfW = Math.min(w, h) * (0.065 + Math.random() * 0.07) * (0.55 + density)
    glow.push([x, y, halfW, density])
  }

  const speckles = []
  const N = 320
  for (let i = 0; i < N; i++) {
    const t = (Math.random() - 0.5) * length
    const core = Math.exp(-((t / (length * 0.34)) ** 2))
    if (Math.random() > core * 0.85 + 0.05) continue
    const perp = (Math.random() - 0.5) * Math.min(w, h) * 0.16 * (0.35 + core)
    const x = cx + dx * t - dy * perp
    const y = cy + dy * t + dx * perp
    const [cr, cg, cb] = starColor()
    speckles.push([x, y, starSize() * 0.65, (0.035 + Math.random() * 0.065) * (0.4 + core), `${cr},${cg},${cb}`])
  }

  return { glow, speckles }
}

export function drawMilkyWay(ctx, mw) {
  const { glow, speckles } = mw

  ctx.save()
  ctx.globalCompositeOperation = 'lighten' // max, not sum — no double-alpha blotching
  for (const [x, y, halfW, density] of glow) {
    const peak = 0.026 * density // kept low: never allowed to rival the moon
    const g = ctx.createRadialGradient(x, y, 0, x, y, halfW)
    g.addColorStop(0, `rgba(203,208,230,${peak})`)
    g.addColorStop(1, 'rgba(203,208,230,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, halfW, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  for (const [x, y, r, alpha, color] of speckles) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = `rgb(${color})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// Astronomical season (Northern hemisphere / Japan) for the drifting elements:
// spring → sakura, summer → fireflies, autumn → momiji, winter → snow.
export function season(date = new Date()) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const onOrAfter = (mm, dd) => m > mm || (m === mm && d >= dd)
  if (onOrAfter(12, 21) || !onOrAfter(3, 20)) return 'winter'
  if (!onOrAfter(6, 21)) return 'spring'
  if (!onOrAfter(9, 22)) return 'summer'
  return 'autumn'
}

// ── Mount Fuji ──────────────────────────────────────────────────────────────
// Precompute Fuji's geometry once (it never animates, and per-frame randomness
// would make the snow shimmer). The silhouette uses Fuji's signature CONCAVE
// slopes (width ∝ (1-height)^1.55 → steep near the summit, flaring at the base),
// a slightly flat summit, and a snow cap with a jagged, streaked lower edge.
export function makeFuji(w, h) {
  const cx = w * 0.5
  const baseY = h + 6
  // Broad and low: as wide as the frame allows, rising only ~40% of the height,
  // with a flat-ish summit — Fuji is wide, not a spire.
  const half = w * 0.92
  const height = Math.min(h * 0.42, half * 0.72)
  const peakY = baseY - height
  const P = 1.28 // gentle concavity (flared base, not pinched to a point)
  const uTop = 0.9 // leave a small flat summit
  const widthAt = (u) => half * Math.pow(1 - u, P)
  const yAt = (u) => baseY - u * height

  const N = 64
  const outline = []
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * uTop
    outline.push([cx - widthAt(u), yAt(u)])
  }
  // a subtle crater dip across the flat summit
  outline.push([cx, yAt(uTop) + height * 0.02])
  for (let i = N; i >= 0; i--) {
    const u = (i / N) * uTop
    outline.push([cx + widthAt(u), yAt(u)])
  }

  // Snow cap: up the left slope to the summit, down the right slope to the snow
  // line, then a soft, gently-tongued lower edge back across (no sharp claws).
  const snowU = 0.52
  const snowY = yAt(snowU)
  const leftX = cx - widthAt(snowU)
  const rightX = cx + widthAt(snowU)
  const snow = []
  for (let i = 0; i <= 22; i++) {
    const u = snowU + (uTop - snowU) * (i / 22)
    snow.push([cx - widthAt(u), yAt(u)])
  }
  snow.push([cx, yAt(uTop) + height * 0.02])
  for (let i = 22; i >= 0; i--) {
    const u = snowU + (uTop - snowU) * (i / 22)
    snow.push([cx + widthAt(u), yAt(u)])
  }
  // A few irregular tongues of snow reaching down the gullies (fixed positions
  // and depths so it's organic but never shimmers), over a gentle undulation.
  const tongues = [
    [0.18, 0.05],
    [0.34, 0.028],
    [0.5, 0.075],
    [0.63, 0.032],
    [0.8, 0.055],
  ]
  const segs = 40
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const x = rightX + (leftX - rightX) * t
    let dip = Math.sin(t * Math.PI * 3 + 0.4) * height * 0.01
    for (const [c, d] of tongues) {
      dip += d * height * Math.exp(-((t - c) * (t - c)) / 0.004)
    }
    snow.push([x, snowY + height * 0.01 + dip])
  }

  // Faint gully lines fanning from the summit give the cone volume, so it reads
  // as Fuji rather than a flat triangle.
  const gullies = [-0.42, -0.16, 0.14, 0.4]

  return { outline, snow, gullies, cx, peakY, half, baseY, height, snowY }
}

// Draw the precomputed Fuji, dim and moonlit to match the moon's weight.
export function drawFuji(ctx, fuji, moonX = 0.7) {
  const { outline, snow, gullies, cx, peakY, half, baseY, height } = fuji
  ctx.save()

  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (const [x, y] of outline) ctx.lineTo(x, y)
  ctx.closePath()
  ctx.clip()

  const body = ctx.createLinearGradient(0, peakY, 0, baseY)
  body.addColorStop(0, '#161520')
  body.addColorStop(1, '#08070d')
  ctx.fillStyle = body
  ctx.fillRect(cx - half - 2, peakY - 8, half * 2 + 4, height + 16)

  // faint gullies fanning from the summit — soft dark ridgelines for volume
  ctx.globalAlpha = 0.5
  for (const gx of gullies) {
    const baseX = cx + gx * half
    const grad = ctx.createLinearGradient(cx, peakY, baseX, baseY)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.28)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(cx, peakY + height * 0.08)
    ctx.quadraticCurveTo((cx + baseX) / 2, peakY + height * 0.5, baseX, baseY)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // a faint rim of moonlight down the moon-facing slope
  const rim = ctx.createLinearGradient(cx - half, 0, cx + half, 0)
  const edge = 'rgba(155,155,192,0.1)'
  if (moonX >= 0.5) {
    rim.addColorStop(0.5, 'rgba(0,0,0,0)')
    rim.addColorStop(1, edge)
  } else {
    rim.addColorStop(0, edge)
    rim.addColorStop(0.5, 'rgba(0,0,0,0)')
  }
  ctx.fillStyle = rim
  ctx.fillRect(cx - half, peakY - 8, half * 2, height + 16)

  // snow cap — dim, cool, moonlit (matched to the moon's muted lilac)
  ctx.beginPath()
  ctx.moveTo(snow[0][0], snow[0][1])
  for (const [x, y] of snow) ctx.lineTo(x, y)
  ctx.closePath()
  const snowGrad = ctx.createLinearGradient(0, peakY, 0, peakY + height * 0.42)
  snowGrad.addColorStop(0, 'rgba(176,175,205,0.42)')
  snowGrad.addColorStop(1, 'rgba(140,140,172,0.14)')
  ctx.fillStyle = snowGrad
  ctx.fill()

  ctx.restore()
}

// Draw the moon at its true phase on a 2D canvas context. Deliberately dim: the
// lit face is a soft, low glow and the shadow side is barely perceptible, so it
// never lights a dark room.
// Fixed maria (the moon's dark "seas"), in disc-normalised coordinates so they
// stay put frame to frame — [x, y, radius, darkness]. They texture both the lit
// face and (faintly) the earthshine side, so it reads as a body, not a plate.
// Irregular maria (dark seas), disc-normalised [x, y, radius, darkness]. A few
// large, overlapping, uneven blotches — a moon face, not a ring of dots.
const MARIA = [
  [-0.18, -0.26, 0.42, 0.42],
  [0.1, -0.34, 0.26, 0.34],
  [0.28, -0.02, 0.34, 0.4],
  [0.02, 0.18, 0.4, 0.36],
  [-0.32, 0.06, 0.24, 0.34],
  [0.34, 0.36, 0.18, 0.28],
]

export function drawMoon(ctx, cx, cy, r, phase, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha

  // faint halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.6)
  halo.addColorStop(0, 'rgba(188,186,224,0.07)')
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  // earthshine (dark side) — barely visible, so a crescent still reads as a
  // crescent, not a full grey disc with a bright edge
  ctx.fillStyle = 'rgba(42,40,62,0.28)'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // lit face, bounded by the terminator ellipse, with a photometric gradient:
  // brightest at the limb, dimming toward the terminator (as on a real sphere).
  const waxing = phase <= 0.5
  const ellipseW = r * Math.cos(phase * 2 * Math.PI)
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing)
  ctx.ellipse(cx, cy, Math.abs(ellipseW), r, 0, Math.PI / 2, -Math.PI / 2, ellipseW > 0 ? waxing : !waxing)
  ctx.closePath()
  const brightX = waxing ? cx + r : cx - r
  const termX = waxing ? cx - r : cx + r
  const lit = ctx.createLinearGradient(termX, 0, brightX, 0)
  lit.addColorStop(0, 'rgba(120,119,150,1)')
  lit.addColorStop(1, 'rgba(186,184,214,1)')
  ctx.fillStyle = lit
  ctx.fill()

  // maria over the whole disc (soft dark seas)
  for (const [mx, my, mr, md] of MARIA) {
    const gx = cx + mx * r
    const gy = cy + my * r
    const grr = mr * r
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, grr)
    g.addColorStop(0, `rgba(36,34,56,${md})`)
    g.addColorStop(1, 'rgba(36,34,56,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(gx, gy, grr, 0, Math.PI * 2)
    ctx.fill()
  }

  // limb darkening — a shaded rim so it reads as a sphere, not a disc
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
  limb.addColorStop(0, 'rgba(0,0,12,0)')
  limb.addColorStop(1, 'rgba(0,0,14,0.3)')
  ctx.fillStyle = limb
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  ctx.restore()
  ctx.restore()
}

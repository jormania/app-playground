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

// Shared screen-mapping, used by BOTH the moon disc and its arc so the two can
// never disagree: altitude → vertical position (horizon rests low, ~60°+ rides
// near the top), and a rise→set fraction → horizontal position.
const ARC_Y_LOW = 1 - MARGIN_BOTTOM - 0.12 // just above the below-horizon resting spot
const ARC_Y_HIGH = MARGIN_TOP
const altToY = (altDeg) => ARC_Y_LOW - (ARC_Y_LOW - ARC_Y_HIGH) * Math.min(1, Math.max(0, altDeg) / 60)
const arcXAt = (t) => MARGIN_X + (1 - 2 * MARGIN_X) * t // t: 0 = rise (left), 1 = set (right)

// Fallback moon placement, used when there's no arc to sit on: no location at
// all (a gentle decorative moon, low on the right), or the moon below the
// horizon (presence 0 — genuinely not up, so not drawn). When the moon IS up
// and we have its arc, moonOnArc places it instead, exactly on the path.
export function moonPlacement(pos) {
  const clampX = (x) => Math.min(1 - MARGIN_X, Math.max(MARGIN_X, x))
  if (!pos) return { x: clampX(0.72), y: 1 - MARGIN_BOTTOM - 0.06, presence: 0.85 }
  // azimuth: SunCalc measures from south, + toward west, in degrees.
  const x = clampX(0.5 + 0.42 * Math.sin((pos.azimuth * Math.PI) / 180))
  if (pos.altitude <= 0) return { x, y: 1 - MARGIN_BOTTOM, presence: 0 }
  return { x, y: altToY(pos.altitude), presence: 0.7 + 0.3 * Math.min(1, pos.altitude / 60) }
}

// ── Moon arc — the moon's path across tonight's sky ──────────────────────
// The dotted dome from the familiar sky-path diagram: the moon's whole
// above-horizon journey, rise to set, traced as a faint arc it travels along.
//
// Parametrised by TIME — evenly from rise (left) to set (right), the vertical
// following real altitude — NOT by azimuth. Azimuth is the "true" horizontal
// angle, but mapping it to an x fold backs on itself whenever the moon passes
// more than 90° from due south, pinning at a screen edge while it climbs — the
// vertical double-back an earlier version showed. A steady rise→set sweep is
// always a clean dome, matches how these diagrams are drawn, and (sharing
// altToY/arcXAt with moonPlacement) lets the moon disc sit exactly on it.
const ARC_SCAN_STEP_MIN = 10
const ARC_SCAN_SPAN_HOURS = 17 // each side of now — longer than a full up-period, so both
// the rise and set crossings are in range wherever "now" falls within it (a long summer
// moon can be up ~16h; beyond the window the arc simply ends at the window edge)
const ARC_POINTS = 88

// Resolve the moon's current (or, if it's down, nearest) above-horizon window
// and trace it. Returns { points: [{x,y}], riseAt, setAt } with absolute ms
// timestamps (so moonOnArc can place the disc on it later), or null when
// there's no location or no resolvable window.
export function moonArc(date, coords) {
  if (!coords) return null
  const t0 = date.getTime()
  const stepMs = ARC_SCAN_STEP_MIN * 60 * 1000
  const half = Math.round((ARC_SCAN_SPAN_HOURS * 60) / ARC_SCAN_STEP_MIN)
  const offsetAt = (i) => (i - half) * stepMs // sample index → ms offset from now

  // Sample altitude across a wide window centred on now.
  const alt = []
  for (let i = 0; i <= 2 * half; i++) {
    const pos = moonPosition(new Date(t0 + offsetAt(i)), coords)
    alt.push(pos ? pos.altitude : null)
  }
  const nowIdx = half

  // Collect every contiguous above-horizon run, then pick the one nearest now
  // (the one containing it when the moon is up; otherwise the closest, so a
  // moon just below the horizon still previews the arc it's about to rise into
  // or has just set out of).
  const runs = []
  for (let i = 0, start = -1; i <= alt.length; i++) {
    const up = i < alt.length && alt[i] != null && alt[i] > 0
    if (up && start < 0) start = i
    else if (!up && start >= 0) {
      runs.push([start, i - 1])
      start = -1
    }
  }
  if (!runs.length) return null
  let best = null
  let bestDist = Infinity
  for (const r of runs) {
    const d = nowIdx < r[0] ? r[0] - nowIdx : nowIdx > r[1] ? nowIdx - r[1] : 0
    if (d < bestDist) {
      bestDist = d
      best = r
      if (d === 0) break
    }
  }

  // Refine the rise/set instants to the true horizon crossing rather than
  // snapping to the nearest 10-minute scan tick, so the arc ends at the ground.
  const riseMs = zeroCrossMs(alt, best[0], -1, offsetAt)
  const setMs = zeroCrossMs(alt, best[1], 1, offsetAt)
  if (!(setMs > riseMs)) return null

  const points = []
  for (let k = 0; k < ARC_POINTS; k++) {
    const t = k / (ARC_POINTS - 1)
    const pos = moonPosition(new Date(t0 + riseMs + (setMs - riseMs) * t), coords)
    points.push({ x: arcXAt(t), y: altToY(pos ? pos.altitude : 0) })
  }
  return { points, riseAt: t0 + riseMs, setAt: t0 + setMs }
}

// Linear-interpolated ms offset where altitude crosses zero, between an
// above-horizon sample i and its neighbour in direction dir (below the horizon,
// or off the window edge — then falls back to i's own offset, no refinement).
function zeroCrossMs(alt, i, dir, offsetAt) {
  const a = alt[i]
  const b = alt[i + dir]
  if (a == null || b == null || b > 0) return offsetAt(i)
  return offsetAt(i) + (offsetAt(i + dir) - offsetAt(i)) * (a / (a - b)) // a>0, b<=0
}

// The moon's screen position right now, sitting ON its cached arc: now → t →
// x, real altitude → y and presence. Keeps the disc and the path from ever
// disagreeing. Returns { x, y, presence } or null when the moon is below the
// horizon (outside the arc's window) — the caller then falls back to
// moonPlacement (an invisible below-horizon moon, or the no-location one).
export function moonOnArc(date, coords, arc) {
  if (!arc) return null
  const now = date.getTime()
  if (now < arc.riseAt || now > arc.setAt) return null
  const pos = moonPosition(date, coords)
  if (!pos || pos.altitude <= 0) return null
  const t = (now - arc.riseAt) / (arc.setAt - arc.riseAt)
  return { x: arcXAt(t), y: altToY(pos.altitude), presence: 0.7 + 0.3 * Math.min(1, pos.altitude / 60) }
}

// A faint, finely-dotted arc — present but never competing with the moon or
// stars — fading softly into the horizon at both ends.
const ARC_PEAK_ALPHA = 0.26
const ARC_DOT_R = 1.3
const ARC_FADE = 0.12 // fraction of the arc each end fades over
export function drawMoonArc(ctx, arc, w, h) {
  if (!arc) return
  const pts = arc.points
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const edge = Math.min(i, n - 1 - i) / (n * ARC_FADE)
    const alpha = ARC_PEAK_ALPHA * Math.min(1, edge)
    if (alpha <= 0.004) continue
    ctx.fillStyle = `rgba(200,199,226,${alpha})`
    ctx.beginPath()
    ctx.arc(pts[i].x * w, pts[i].y * h, ARC_DOT_R, 0, Math.PI * 2)
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

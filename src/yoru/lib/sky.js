import { getMoonIllumination, getMoonPosition, getPosition as getSunPosition } from 'suncalc'
import { nightKey } from './night'

// Real lunar data for Yoru's "Go dark" sky. The moon's PHASE is the same the
// world over at a given instant; its POSITION (whether it's up, and where) is
// location-based, so we use coordinates when the user grants them.

// { fraction: illuminated 0..1, phase: 0=new .5=full 1=new } — always available.
export function moonPhase(date = new Date()) {
  const m = getMoonIllumination(date)
  return { fraction: m.fraction, phase: m.phase }
}

// The familiar eight-name phase, from the same 0..1 value moonPhase returns.
const PHASE_NAMES = [
  [0.02, 'new moon'],
  [0.24, 'waxing crescent'],
  [0.26, 'first quarter'],
  [0.48, 'waxing gibbous'],
  [0.52, 'full moon'],
  [0.74, 'waning gibbous'],
  [0.76, 'last quarter'],
  [0.98, 'waning crescent'],
  [1.01, 'new moon'], // catches the top of the range (phase can land exactly at 1)
]
export function moonPhaseName(phase) {
  for (const [upTo, name] of PHASE_NAMES) if (phase < upTo) return name
  return 'new moon'
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

// Which way the moon's lit edge actually points tonight, in radians,
// counter-clockwise-positive from straight up (the zenith) — matching the
// facing-south, altitude-is-up framing of azToX/altToY.
//
// A real crescent does not sit bolt upright with its horns pinned left or
// right; it leans, because the bright limb always points at the sun, and it
// keeps turning through the night as the moon rides its arc — a crescent that
// hangs like a bowl low in the west stands up on its end by the time it sets.
// suncalc gives the two pieces: `angle`, the bright limb's position angle from
// the moon's north point, and `parallacticAngle`, how much the whole disc is
// rotated in a horizon (alt-az) view like this one. Their difference is the
// angle from the zenith. Both are DEGREES here (see moonPosition's note).
//
// Null without a location: the parallactic angle needs one, and an upright
// default moon is a better answer than a confidently wrong tilt.
export function moonBrightLimb(date, coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  try {
    const ill = getMoonIllumination(date)
    const pos = getMoonPosition(date, coords.lat, coords.lon)
    if (!Number.isFinite(ill.angle) || !Number.isFinite(pos.parallacticAngle)) return null
    return ((ill.angle - pos.parallacticAngle) * Math.PI) / 180
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

// Azimuth → screen x. The whole frame is a view FACING SOUTH — the framing the
// arc above already commits to, since it runs rise (east) on the left to set
// (west) on the right, exactly like the sky-path diagram it's drawn from. So:
// east (90°) → left, south (180°) → centre, west (270°) → right.
//
// NOTE, in the same vein as moonPosition's degrees/radians note below: this
// installed suncalc (2.x) measures azimuth NORTH-based clockwise (0 = N, 90 =
// E, 180 = S, 270 = W). Classic 1.x measured it from the SOUTH, + toward the
// west — and under that convention `0.5 + 0.42 * sin(az)`, which is what this
// file used to do, put west on the right correctly. Handed a north-based
// azimuth the very same expression mirrors the sky east-for-west: dusk glowed
// on the LEFT while the moon set to the right, contradicting its own arc. The
// sign is flipped here, once, for everything that maps an azimuth.
const azToX = (azDeg) =>
  Math.min(1 - MARGIN_X, Math.max(MARGIN_X, 0.5 - 0.42 * Math.sin((azDeg * Math.PI) / 180)))

// Fallback moon placement, used when there's no arc to sit on: no location at
// all (a gentle decorative moon, low on the right), or the moon below the
// horizon (presence 0 — genuinely not up, so not drawn). When the moon IS up
// and we have its arc, moonOnArc places it instead, exactly on the path.
export function moonPlacement(pos) {
  const clampX = (x) => Math.min(1 - MARGIN_X, Math.max(MARGIN_X, x))
  if (!pos) return { x: clampX(0.72), y: 1 - MARGIN_BOTTOM - 0.06, presence: 0.85 }
  const x = azToX(pos.azimuth)
  if (pos.altitude <= 0) return { x, y: 1 - MARGIN_BOTTOM, presence: 0 }
  return { x, y: altToY(pos.altitude), presence: 0.7 + 0.3 * Math.min(1, pos.altitude / 60) }
}

// Altitude/azimuth → screen (fractions 0..1) — the shared mapping, exported so
// that anything else real we hang in this sky (a meteor shower's radiant, say)
// lands exactly where the same altitude and azimuth would put the sun's glow.
//
// Note the one deliberate exception: the MOON takes its x from its rise→set
// arc rather than from azToX, for the folding reason set out at moonArc below.
// So the moon is placed on a time sweep while the twilight and the radiants are
// placed by azimuth. Both are honest about altitude and both agree on which
// side of the sky is which; they just parametrise the horizontal differently.
export function skyToScreen(pos) {
  if (!pos) return null
  return { x: azToX(pos.azimuth), y: altToY(pos.altitude) }
}

// ── Twilight horizon ──────────────────────────────────────────────────────
// A faint warm wash low on the sky, tracking the REAL sun — present only
// while it's near the horizon (dusk or dawn twilight), peaking right at
// sunset/sunrise and gone by full daylight above or true astronomical night
// below. Most sessions start well after twilight has faded, so on most
// nights this simply never appears — an honest touch, not a fixed effect.
const TWILIGHT_FADE_ABOVE = 3 // sun altitude (deg) above the horizon where the glow is gone (daylight)
const TWILIGHT_FADE_BELOW = 12 // sun altitude below the horizon where the glow is gone (twilight over)

export function twilight(date, coords) {
  if (!coords) return null
  const pos = getSunPosition(date, coords.lat, coords.lon)
  // Like moonPosition (see its own note above): this installed suncalc
  // returns both altitude and azimuth already in DEGREES, not radians.
  if (!pos || !Number.isFinite(pos.altitude) || !Number.isFinite(pos.azimuth)) return null
  const intensity =
    pos.altitude >= 0
      ? Math.max(0, 1 - pos.altitude / TWILIGHT_FADE_ABOVE)
      : Math.max(0, 1 - -pos.altitude / TWILIGHT_FADE_BELOW)
  if (intensity <= 0) return null
  return { intensity, x: azToX(pos.azimuth) }
}

// ── The air itself ───────────────────────────────────────────────────────
// Night is not one flat black. Straight up you look through the least air
// there is, so the zenith is the darkest part of any sky; toward the horizon
// the same glance crosses many times more atmosphere, which scatters a little
// of whatever light is about back at you. The lift below is slight — under
// what you'd consciously notice — but without it the frame reads as a painted
// wall rather than depth you're looking into.
export function drawSkyBackdrop(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#030309')
  g.addColorStop(0.55, '#05050c')
  g.addColorStop(1, '#0b0b16')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// The other half of that same fact: the thick air near the horizon doesn't
// only glow, it absorbs — which is why stars visibly fade out as they sink
// rather than staying sharp all the way down to the ground. `y` is normalised
// (0 = top of frame, 1 = bottom); returns a brightness multiplier.
export function extinction(y) {
  if (y < 0.62) return 1
  return 1 - 0.62 * Math.min(1, (y - 0.62) / 0.38)
}

// A soft, low horizon glow — behind everything else in the sky, so stars,
// the Milky Way, the moon and its arc all sit on top of it undimmed.
export function drawTwilight(ctx, tw, w, h) {
  if (!tw) return
  const cx = tw.x * w
  const bandCy = h * 0.78
  const radius = w * 0.62
  const peak = 0.16 * tw.intensity
  const grad = ctx.createRadialGradient(cx, bandCy, 0, cx, bandCy, radius)
  grad.addColorStop(0, `rgba(255,148,92,${peak})`)
  grad.addColorStop(0.55, `rgba(224,120,88,${peak * 0.4})`)
  grad.addColorStop(1, 'rgba(224,120,88,0)')
  ctx.save()
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
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
// `hide` — {x, y, r} in px, the moon's own disc. The moon rides ON this arc and
// is drawn at half opacity, so without cutting the dots out from under it the
// path shows straight THROUGH the disc as a dashed line ruled across the moon's
// face — most obvious near culmination, where the apex crosses it horizontally.
// The arc simply passes behind the moon, which is what it does in the sky and
// in every sky-path diagram this is drawn from.
export function drawMoonArc(ctx, arc, w, h, hide = null) {
  if (!arc) return
  const pts = arc.points
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const edge = Math.min(i, n - 1 - i) / (n * ARC_FADE)
    const alpha = ARC_PEAK_ALPHA * Math.min(1, edge)
    if (alpha <= 0.004) continue
    const px = pts[i].x * w
    const py = pts[i].y * h
    if (hide && Math.hypot(px - hide.x, py - hide.y) < hide.r) continue
    ctx.fillStyle = `rgba(200,199,226,${alpha})`
    ctx.beginPath()
    ctx.arc(px, py, ARC_DOT_R, 0, Math.PI * 2)
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

// `field` is the optional touch field (see NightSky): the band's speckle stars
// answer to a finger exactly as the ordinary star field does, so stirring the
// sky stirs ALL of it and the Milky Way doesn't sit there conspicuously frozen
// while everything around it moves.
//
// `zoom` cancels the view transform out of the speckle radii — see the note on
// the star field in NightSky: magnifying the sky spreads stars apart but must
// not fatten them, because they have no disc to magnify.
export function drawMilkyWay(ctx, mw, h, field = null, zoom = 1) {
  const { glow, speckles } = mw

  ctx.save()
  ctx.globalCompositeOperation = 'lighten' // max, not sum — no double-alpha blotching
  for (const [x, y, halfW, density] of glow) {
    const peak = 0.026 * density * extinction(y / h) // kept low: never allowed to rival the moon
    if (peak <= 0.001) continue
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
    const t = field ? field.sample(x, y) : null
    const px = t ? x + t.ox : x
    const py = t ? y + t.oy : y
    const a = alpha * extinction(py / h) * (t ? 1 + t.bump * 3.4 : 1)
    if (a <= 0.002) continue
    ctx.globalAlpha = Math.min(1, a)
    ctx.fillStyle = `rgb(${color})`
    ctx.beginPath()
    ctx.arc(px, py, (r * (t ? 1 + t.bump * 0.55 : 1)) / zoom, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── Telling you where the moon is ────────────────────────────────────────
// A quiet line of plain language, for the top bar. Yoru only ever draws the sky
// in "go dark", so in the other two modes there is otherwise nothing at all to
// say whether there's a moon out — and knowing that is half of why you'd look up.

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
const compass = (azDeg) => COMPASS[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8]
const heightWord = (altDeg) => (altDeg < 12 ? 'low ' : altDeg > 50 ? 'high ' : '')

// Approximate on purpose — to the nearest half hour, and prefixed "around" by
// the caller. Nobody lying in bed needs the moon to the minute, and a precise
// 23:47 reads like a timetable. 24-hour, like the rest of the app (see
// Session's formatClock: toLocaleTimeString hands back 12-hour AM/PM in several
// locales, which reads worse here).
function aboutClock(ms) {
  const d = new Date(ms)
  d.setMinutes(Math.round(d.getMinutes() / 30) * 30, 0, 0) // 60 rolls the hour for us
  if (d.getHours() === 0 && d.getMinutes() === 0) return 'midnight'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "tonight" or "tomorrow", by Yoru's OWN night — which rolls at 4am, not
// midnight. That's the whole point: at 11pm, a moon coming up at 1am is still
// tonight to anyone awake to see it, even though the calendar disagrees.
const whenWord = (ms, now) => (nightKey(ms) === nightKey(now.getTime()) ? 'tonight' : 'tomorrow')

// The next time the moon actually comes up. moonArc deliberately resolves the
// window NEAREST now — so a moon that set an hour ago still shows the path it
// came down — which is the wrong question once it's gone: we want the next
// rise, not the last one. Scans forward for the first crossing up through the
// horizon, then refines it off the 10-minute grid.
const RISE_STEP_MIN = 10
const RISE_SPAN_H = 30 // a moon rises ~50 min later each day, so this always finds one
export function nextMoonrise(date, coords) {
  if (!coords) return null
  const t0 = date.getTime()
  const step = RISE_STEP_MIN * 60000
  let prev = moonPosition(date, coords)
  if (!prev) return null
  for (let i = 1; i <= (RISE_SPAN_H * 60) / RISE_STEP_MIN; i++) {
    const cur = moonPosition(new Date(t0 + i * step), coords)
    if (!cur) return null
    if (prev.altitude <= 0 && cur.altitude > 0) {
      const f = -prev.altitude / (cur.altitude - prev.altitude) // linear-interpolate the crossing
      const at = t0 + (i - 1 + f) * step
      const rp = moonPosition(new Date(at), coords)
      return { at, azimuth: rp ? rp.azimuth : cur.azimuth }
    }
    prev = cur
  }
  return null
}

// One line: what the moon is, and either where it is or when it's due.
// Without a location we can still name the phase — that's the same the world
// over at a given instant — but nothing about where it sits, so we say only
// what we actually know.
export function moonBrief(date = new Date(), coords = null) {
  const name = moonPhaseName(moonPhase(date).phase)
  if (!coords) return name
  const pos = moonPosition(date, coords)
  if (!pos) return name
  if (pos.altitude > 0) return `${name} · ${heightWord(pos.altitude)}in the ${compass(pos.azimuth)}`
  const rise = nextMoonrise(date, coords)
  if (!rise) return `${name} · below the horizon`
  return `${name} · rises ${whenWord(rise.at, date)} around ${aboutClock(rise.at)}, in the ${compass(rise.azimuth)}`
}

// ── Fixed points on the sky ──────────────────────────────────────────────
// Where a point at a given RA/Dec — a star, or a meteor shower's radiant —
// sits right now, in the same altitude/azimuth terms suncalc hands back for
// the sun and the moon. suncalc only does those two, so this is the standard
// equatorial → horizontal rotation by hand: sidereal time gives the hour
// angle, and the hour angle with the declination and your latitude give
// altitude and azimuth.
//
// Degrees in, degrees out, azimuth north-based clockwise — deliberately the
// same shape and convention suncalc returns, so the result drops straight into
// azToX/altToY alongside everything else rather than needing its own mapping.
export function starPosition(date, coords, raDeg, decDeg) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  const days = date.getTime() / 86400000 - 10957.5 // days since J2000.0 (2000-01-01T12:00Z)
  const gmst = 280.46061837 + 360.98564736629 * days
  const lst = (((gmst + coords.lon) % 360) + 360) % 360
  const H = ((lst - raDeg) * Math.PI) / 180 // hour angle
  const dec = (decDeg * Math.PI) / 180
  const lat = (coords.lat * Math.PI) / 180
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H)
  const altitude = (Math.asin(Math.min(1, Math.max(-1, sinAlt))) * 180) / Math.PI
  // Azimuth comes out of atan2 measured from the SOUTH (+ toward the west) —
  // the classic form — so shift it by 180° into the north-based convention.
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat))
  const azimuth = ((((azS * 180) / Math.PI + 180) % 360) + 360) % 360
  if (!Number.isFinite(altitude) || !Number.isFinite(azimuth)) return null
  return { altitude, azimuth }
}

// ── Meteor showers ───────────────────────────────────────────────────────
// Most nights a shooting star is pure chance, and the sky's rare, quiet
// sporadics are the whole of it. But on a handful of real dates the Earth
// ploughs through the dust left along a comet's orbit, and the meteors stop
// being random in both senses: they come several times more often, and they
// all streak away from a single point — the radiant, which is simply the
// direction we're flying into. Yoru follows the actual calendar, the same way
// the twilight wash only shows up when the sun really is near the horizon: on
// any other night this returns null and nothing changes.
//
// peakDoy — day-of-year of the nominal peak (real peaks wander a day either
// way between years; close enough to shape a rate curve). span — days either
// side still counted as active. rate — the multiplier at the very peak.
// ra/dec — the radiant's real position, so it rises and sets like anything
// else up there. That last part matters: the Perseids genuinely are sparse
// before Perseus clears the horizon, and a radiant that's still down should
// not be throwing meteors across the screen.
const SHOWERS = [
  { name: 'Quadrantids', peakDoy: 3, span: 7, rate: 3.2, ra: 230.0, dec: 49.5 },
  { name: 'Lyrids', peakDoy: 112, span: 5, rate: 2.2, ra: 271.4, dec: 33.6 },
  { name: 'Eta Aquariids', peakDoy: 126, span: 9, rate: 2.6, ra: 338.0, dec: -0.8 },
  { name: 'Perseids', peakDoy: 224, span: 12, rate: 4.0, ra: 48.2, dec: 58.1 },
  { name: 'Orionids', peakDoy: 294, span: 9, rate: 2.4, ra: 95.2, dec: 15.8 },
  { name: 'Leonids', peakDoy: 321, span: 7, rate: 2.4, ra: 154.2, dec: 21.6 },
  { name: 'Geminids', peakDoy: 348, span: 8, rate: 4.2, ra: 113.2, dec: 32.3 },
  { name: 'Ursids', peakDoy: 356, span: 4, rate: 1.8, ra: 217.1, dec: 75.8 },
]

export function dayOfYear(date) {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  const here = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((here - start) / 86400000) + 1
}

// Signed day gap the short way round the year, so the Quadrantids — peaking
// Jan 3 with a window that opens the previous December — stay one continuous
// shower instead of being torn in half at New Year.
function dayGap(a, b) {
  let d = a - b
  while (d > 182.5) d -= 365
  while (d < -182.5) d += 365
  return d
}

// Tonight's shower, or null. `strength` is a bell centred on the peak: a
// trickle at the edges of the window, a real event for a night or two in the
// middle. When two windows overlap (December has three), the stronger wins.
export function meteorShower(date = new Date()) {
  let best = null
  const doy = dayOfYear(date)
  for (const s of SHOWERS) {
    const gap = Math.abs(dayGap(doy, s.peakDoy))
    if (gap > s.span) continue
    const strength = Math.exp(-(gap * gap) / (2 * (s.span / 2.4) ** 2))
    if (!best || strength > best.strength) best = { shower: s, strength }
  }
  return best
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
  const coneW = (u) => half * Math.pow(1 - u, P)
  const yAt = (u) => baseY - u * height

  // The Hōei crater — Fuji's one famous asymmetry, blown out of its south-east
  // flank in 1707 and still there as a bulge with a scooped-out hollow. A
  // perfectly mirror-symmetric cone is what makes this read as a pictogram
  // rather than as a mountain, and this is the single feature that makes a
  // photograph of Fuji recognisable as Fuji. Only the right flank carries it.
  // NOTE the height: the cone is far wider than the frame (half is 0.92w about a
  // centred axis), so its flanks only come inside the left and right edges above
  // u ≈ 0.38 — everything below that is cropped away off-screen. A crater set at
  // its true height down the flank would be perfectly accurate and completely
  // invisible. This sits at the lowest point that's actually in shot.
  const HOEI_U = 0.46
  const HOEI_SPREAD = 0.09
  const HOEI_BULGE = 0.07 // how far it swells the silhouette
  const hoei = (u) => Math.exp(-((u - HOEI_U) ** 2) / (2 * HOEI_SPREAD ** 2))
  const leftW = (u) => coneW(u)
  const rightW = (u) => coneW(u) * (1 + HOEI_BULGE * hoei(u))

  const N = 64
  const outline = []
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * uTop
    outline.push([cx - leftW(u), yAt(u)])
  }
  // a subtle crater dip across the flat summit
  outline.push([cx, yAt(uTop) + height * 0.02])
  for (let i = N; i >= 0; i--) {
    const u = (i / N) * uTop
    outline.push([cx + rightW(u), yAt(u)])
  }

  // Snow cap: up the left slope to the summit, down the right slope to the snow
  // line, then a soft, gently-tongued lower edge back across (no sharp claws).
  // The line sits high — a cap, not a shroud: it used to start at 0.52, which
  // put snow over most of the mountain's visible area and left it reading as one
  // pale triangle no matter what the light was doing.
  const snowU = 0.58
  const snowY = yAt(snowU)
  const leftX = cx - leftW(snowU)
  const rightX = cx + rightW(snowU)
  const snow = []
  for (let i = 0; i <= 22; i++) {
    const u = snowU + (uTop - snowU) * (i / 22)
    snow.push([cx - leftW(u), yAt(u)])
  }
  snow.push([cx, yAt(uTop) + height * 0.02])
  for (let i = 22; i >= 0; i--) {
    const u = snowU + (uTop - snowU) * (i / 22)
    snow.push([cx + rightW(u), yAt(u)])
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

  // ── Shading bands ──────────────────────────────────────────────────────
  // The cone is shaded for real (see drawFuji), which needs its geometry as a
  // stack of thin horizontal slices: across any one slice the height barely
  // changes, so the slope is constant and the only thing varying is how far
  // round the cone you are — which is exactly a horizontal gradient.
  //
  // sinT/cosT come from the surface normal. On a slope rising at angle T from
  // horizontal the outward normal is (sin T) out from the axis and (cos T) up:
  // a vertical wall's normal points straight out, flat ground's points straight
  // up. Fuji being concave, T steepens toward the summit — so the flanks take
  // side-light well and the shallower base takes overhead light well, which is
  // the whole reason a low moon models this mountain and a high one flattens it.
  // Enough of them, bunched toward the summit. Each band is filled with one
  // horizontal gradient stretched to that band's OWN width, so band to band the
  // cone's width — and with it the mapping from screen x to how far round the
  // cone you are — takes a step. Where the cone narrows fastest that step is
  // proportionally biggest, so spacing the bands by (1-t)^1.7 puts the thin ones
  // exactly where the width is running away. The stepping only shows under
  // raking light, where shade swings hardest across the cone: 24 bands still
  // striped there, 48 doesn't, and beyond that you're paying for something no
  // one can see. (The heavy corduroy the snow once had was a different bug —
  // see the snow pass in drawFuji — so don't reach for more bands if it returns.)
  const BANDS = 48
  const bandU = (t) => uTop * (1 - Math.pow(1 - t, 1.7))
  const bands = []
  for (let i = 0; i < BANDS; i++) {
    const u0 = bandU(i / BANDS)
    const u1 = bandU((i + 1) / BANDS)
    const um = (u0 + u1) / 2
    const drdu = half * P * Math.pow(1 - um, P - 1) // how fast it flares, per unit height
    const T = Math.atan2(height, drdu)
    bands.push({
      yTop: yAt(u1),
      yBot: yAt(u0),
      lw: leftW(um),
      rw: rightW(um),
      sinT: Math.sin(T),
      cosT: Math.cos(T),
      // Which bands the snow pass needs. Not simply "above the snow line": the
      // cap's tongues reach down BELOW it, and gating on the line alone left
      // those tongues unpainted — a straight horizontal edge sliced across the
      // bottom of the snow where the band stack ran out.
      snow: yAt(u1) < snowY + height * 0.09,
    })
  }

  // Radial ridges fanning from the summit — the fluting every big volcanic cone
  // has. Position across the cone (−1 left limb … +1 right limb) and a weight,
  // so they're uneven rather than a comb.
  const ridges = [
    [-0.82, 0.6],
    [-0.63, 0.9],
    [-0.44, 0.5],
    [-0.24, 0.8],
    [-0.08, 0.45],
    [0.12, 0.75],
    [0.3, 0.5],
    [0.48, 0.95],
    [0.66, 0.6],
    [0.85, 0.7],
  ]

  return { outline, snow, bands, ridges, cx, peakY, half, baseY, height, snowY, hoeiAt: [cx + coneW(HOEI_U) * 0.66, yAt(HOEI_U)] }
}

// Rock and snow, each from its own shadow to its own full moonlight. Fuji is
// never allowed to get BRIGHTER overall than it was — the point of shading it
// properly is form, not glare. The far flank now goes darker than the old flat
// fill ever did while the near one picks up an edge.
// Tuned at both ends. The brightest case there is — a full moon riding high,
// lighting the whole cone at once — lands near the brightness the old flat fill
// had at its peak (form, not glare). The darkest — no moon at all — still has to
// leave the SLOPES readable, not just a snow cap floating alone in the dark.
const ROCK_DARK = [8, 8, 14]
const ROCK_LIT = [34, 34, 46]
const SNOW_DARK = [26, 26, 40]
const SNOW_LIT = [104, 104, 130]
// Starlight and skyglow: the floor, and deliberately NOT scaled by the moon —
// a real landscape is never black. Even at new moon the whole sky dome is a
// dim source, and because it hangs overhead it favours whatever faces up, hence
// the cosT weighting. This is what keeps Fuji present on a moonless night.
const AMBIENT = 0.34
// How hard the moon's own directional light drives on top of that floor. Held
// back so the ambient lift doesn't push a full moon into glare.
const MOON_GAIN = 0.62
// The moon's arc runs x = 0.24 … 0.76, so ±0.26 from centre is its whole
// east→west swing — the scale that turns its screen x into a light direction.
const HALF_SWEEP = 0.26

// Draw the precomputed Fuji, dim and moonlit to match the moon's weight.
//
// `moon` is {xFrac, altitude, light}: where the moon sits across the frame
// (0..1), how high it really is (degrees, null without a location), and how
// much it has to give (illuminated fraction × presence). There is ONE light
// source in this scene and the mountain obeys it, the same way the moon's own
// face does: the flank facing the moon takes the light, the far one falls away,
// and the terminator between them runs down the cone and MOVES as the moon
// crosses the sky. (It used to be `if (moonX >= 0.5)` — light the right half,
// else the left — which is both flat and discontinuous: the lighting flipped
// flanks in a single frame as the moon passed the meridian.)
//
// A full moon riding high silvers the snow; a thin crescent barely touches it;
// a new moon, or one still below the horizon, leaves Fuji lit by starlight
// alone — faint, but its slopes still there.
export function drawFuji(ctx, fuji, moon) {
  const { outline, snow, bands, ridges, cx, peakY, half, baseY, height, hoeiAt } = fuji
  const light = Math.min(1, Math.max(0, moon?.light ?? 1))
  // What the surface markings (ridges, the Hōei hollow, the rim scatter) are
  // worth. They keep a floor of their own: they're most of what makes the
  // slopes read as slopes, so they must not vanish with the moon.
  const lit = 0.3 + 0.7 * light

  // The light's direction. Elevation comes from the moon's REAL altitude, not
  // from where it happens to sit on screen relative to the mountain: Fuji stands
  // on the horizon, so what matters is how high the moon is above THAT. (Screen
  // geometry gets this badly wrong — a moon 2° up still floats well above the
  // mountain's middle in frame, which read as near-overhead light and flooded
  // the whole cone flat.) A moon on the horizon rakes in sideways and models the
  // flanks hard; a high one comes from above and flattens them, which is exactly
  // what a high full moon does to a landscape.
  const hdir = Math.max(-1, Math.min(1, ((moon?.xFrac ?? 0.72) - 0.5) / HALF_SWEEP))
  const elev = ((moon?.altitude ?? 25) * Math.PI) / 180
  const cosE = Math.cos(elev)
  const lx = cosE * hdir
  const ly = Math.max(0, Math.sin(elev))
  // Whatever horizontal is left over points due SOUTH — away from us, behind
  // the mountain. The frame faces south, so a moon at either end of its arc is
  // off east or west and rakes across the flanks, while a moon at mid-arc has
  // culminated in the south: it is behind Fuji, and backlights it. This term is
  // what puts a rim of light around the cone at exactly the moment the moon is
  // highest — without it, straight-overhead light shades a cone to a single
  // value everywhere and the mountain goes back to being a blank pale wedge.
  const lz = -cosE * Math.sqrt(Math.max(0, 1 - hdir * hdir))
  const tone = (dark, bright, shade) => `rgb(${rgbLerp(dark, bright, Math.min(1, Math.max(0, shade)))})`

  // Rebuild the shading only when the light has actually moved. The moon takes
  // hours to cross the sky, so frame to frame this changes by essentially
  // nothing — but building a gradient per band per frame is real work, and
  // caching them is exactly what lets the band count go high enough to kill the
  // striping outright. Gradients are painted through the current transform, so
  // a cached one stays correct under a pinch.
  const key = `${lx.toFixed(3)}|${ly.toFixed(3)}|${lit.toFixed(3)}`
  if (fuji.lightKey !== key) {
    fuji.lightKey = key
    const STOPS = 6
    const ramp = (b, dark, bright) => {
      const g = ctx.createLinearGradient(cx - b.lw, 0, cx + b.rw, 0)
      for (let k = 0; k <= STOPS; k++) {
        const t = k / STOPS
        const nx = t * 2 - 1 // -1 at the left limb, +1 at the right
        // How far round the cone this is: at the limbs the surface has turned
        // away edge-on (0), in the middle it faces us squarely (1) — so the
        // middle is what the southward backlight can't reach.
        const cosPhi = Math.sqrt(Math.max(0, 1 - nx * nx))
        const moonlit = Math.max(0, nx * b.sinT * lx + b.cosT * ly + cosPhi * b.sinT * lz)
        // starlight floor + whatever the moon adds on top of it
        const shade = AMBIENT * b.cosT + moonlit * light * MOON_GAIN
        g.addColorStop(t, tone(dark, bright, shade))
      }
      return g
    }
    for (const b of bands) {
      b.gRock = ramp(b, ROCK_DARK, ROCK_LIT)
      b.gSnow = b.snow ? ramp(b, SNOW_DARK, SNOW_LIT) : null
    }
  }

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (const [x, y] of outline) ctx.lineTo(x, y)
  ctx.closePath()
  ctx.clip()

  // ── The cone, shaded band by band ────────────────────────────────────
  // No vertical body gradient any more. The old one ran light at the peak to
  // dark at the base, which is backwards for a distant mountain — the base is
  // seen through the thickest, haziest air, which is why far ridges dissolve
  // into the murk at their feet, and it fought the haze pass below. Lighting is
  // the light's job now; the air is the haze's. They no longer argue.
  for (const b of bands) {
    ctx.fillStyle = b.gRock
    ctx.fillRect(cx - half, b.yTop, half * 2, b.yBot - b.yTop + 1) // +1: no seams
  }

  // ── Ridges ───────────────────────────────────────────────────────────
  // The fluting fanning down from the summit. These used to be four lines that
  // were dark no matter where the moon was; a real ridge catches light on one
  // side and casts shade on the other, so which one you see depends entirely on
  // where the light is. Near the limbs they read strongest, and under a moon
  // straight overhead they nearly vanish — as radial folds do.
  for (const [g, weight] of ridges) {
    const facing = g * lx // >0 on the moon's side
    const a = 0.06 * lit * weight * (0.2 + 0.8 * Math.abs(facing))
    if (a <= 0.004) continue
    const baseX = cx + g * half
    const grad = ctx.createLinearGradient(cx, peakY, baseX, baseY)
    // lit side → a highlight along the fold; shaded side → the shadow it throws
    const rgb = facing > 0 ? '168,168,204' : '0,0,0'
    const peak = facing > 0 ? a : a * 1.5
    // Fade in from the summit, but be fully up by the time it's a third of the
    // way down: the base of these lines is far off-frame (see makeFuji), so a
    // ramp that only arrived at the base would spend its whole visible length
    // at nearly zero.
    grad.addColorStop(0, `rgba(${rgb},0)`)
    grad.addColorStop(0.33, `rgba(${rgb},${peak})`)
    grad.addColorStop(1, `rgba(${rgb},${peak})`)
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(cx, peakY + height * 0.08)
    ctx.quadraticCurveTo((cx + baseX) / 2, peakY + height * 0.5, baseX, baseY)
    ctx.stroke()
  }

  // The Hōei hollow itself — a scooped crater, so it reads as a shadow rather
  // than a lump. Sits inside the bulge the outline already carries.
  const [hx, hy] = hoeiAt
  const hr = height * 0.16
  const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr)
  hg.addColorStop(0, `rgba(0,0,0,${0.3 * lit})`)
  hg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(hx, hy, hr, 0, Math.PI * 2)
  ctx.fill()

  // ── Snow ─────────────────────────────────────────────────────────────
  // Shaded by the same vector as the rock, from the same moon. A flat pale fill
  // was what made this read as a triangle; snow that has a lit flank and a blue
  // shadow reads as snow lying on something.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(snow[0][0], snow[0][1])
  for (const [x, y] of snow) ctx.lineTo(x, y)
  ctx.closePath()
  ctx.clip()
  // Opaque, deliberately. The bands overlap by a pixel so they can't leave
  // hairline seams, and a semi-transparent fill COMPOUNDS wherever two of them
  // land on the same pixel — which painted a stripe at every single band
  // boundary and was the whole of the corduroy texture across the snow. The
  // rock pass never showed it because the rock was already opaque. Shadowed
  // snow gets its darkness from SNOW_DARK instead.
  for (const b of bands) {
    if (!b.gSnow) continue
    ctx.fillStyle = b.gSnow
    ctx.fillRect(cx - half, b.yTop, half * 2, b.yBot - b.yTop + 1)
  }
  ctx.restore()

  ctx.restore()

  // ── The rim ──────────────────────────────────────────────────────────
  // A hard vector edge is the last thing giving this away as drawn rather than
  // distant. Real air scatters a little light around a moonlit ridge, which
  // both softens the boundary and is a thing you can actually see. Faint, and
  // only as much as the moon is giving.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (const [x, y] of outline) ctx.lineTo(x, y)
  ctx.closePath()
  ctx.strokeStyle = `rgba(126,132,170,${(0.07 * lit).toFixed(4)})`
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.restore()

  // Aerial perspective: a shallow pool of night air at the mountain's foot.
  // Distance is haze — the reason a far ridge looks paler and softer than a
  // near one — and without it Fuji reads as a shape pasted onto the sky rather
  // than a mountain standing some miles off in it. Drawn last and unclipped,
  // over both the base of the mountain and the sky beside it, since the air is
  // in front of both. Spans the frame: `half` is 0.92w about a centred `cx`.
  const hazeTop = baseY - height * 0.62
  const haze = ctx.createLinearGradient(0, hazeTop, 0, baseY)
  haze.addColorStop(0, 'rgba(96,102,140,0)')
  haze.addColorStop(1, `rgba(96,102,140,${(0.15 * lit).toFixed(4)})`)
  ctx.fillStyle = haze
  ctx.fillRect(cx - half, hazeTop, half * 2, baseY - hazeTop)
}

// Draw the moon at its true phase on a 2D canvas context. Deliberately dim: the
// lit face is a soft, low glow and the shadow side is barely perceptible, so it
// never lights a dark room.

// The real near-side maria — the "man in the moon", laid out as the eye
// actually sees him with north up: Imbrium and the long sweep of Procellarum
// down the left, Serenitatis and Tranquillitatis centre-right, Crisium the
// small isolated oval near the eastern limb, Nubium and Humorum low on the
// left. Disc-normalised [x, y, rx, ry, rotation, darkness] — x right, y down,
// 1 = the moon's radius. Ellipses rather than circles, and overlapping,
// because the real seas are anything but round and Imbrium runs into
// Procellarum exactly the way it does up there. They texture the lit face and
// (faintly) the earthshine side, so it reads as a body, not a plate.
const MARIA = [
  [-0.62, -0.06, 0.34, 0.46, -0.18, 0.3], // Oceanus Procellarum — the long western plain
  [-0.34, -0.36, 0.3, 0.26, 0.25, 0.38], // Mare Imbrium — big and round, upper left
  [-0.16, -0.7, 0.36, 0.09, 0.16, 0.2], // Mare Frigoris — a thin arc along the north
  [-0.05, -0.12, 0.09, 0.08, 0.0, 0.22], // Mare Vaporum
  [0.08, -0.34, 0.19, 0.17, 0.0, 0.4], // Mare Serenitatis
  [0.28, -0.1, 0.2, 0.21, -0.3, 0.42], // Mare Tranquillitatis
  [0.58, -0.3, 0.12, 0.1, 0.0, 0.38], // Mare Crisium — the isolated oval near the east limb
  [0.5, 0.14, 0.13, 0.16, 0.1, 0.34], // Mare Fecunditatis
  [0.33, 0.26, 0.09, 0.09, 0.0, 0.3], // Mare Nectaris
  [-0.26, 0.3, 0.18, 0.13, 0.2, 0.3], // Mare Nubium
  [-0.47, 0.33, 0.1, 0.1, 0.0, 0.28], // Mare Humorum
]

// Tycho: the near side's youngest big impact, low and slightly left of centre,
// with the bright rays of its splash thrown clear across the face. They're a
// full-moon phenomenon — at a low sun angle there are no shadows for them to
// contrast against and they simply vanish — which is what `frac` gates below.
//
// [angle, length, width], each ray a soft elongated smudge starting out from
// the crater rather than a line drawn from its centre. Rays are diffuse dust,
// not spokes: a set of straight gradient strokes converging on one bright point
// reads unmistakably as a lens flare or an asterisk stuck on the moon, which is
// exactly what the first attempt here looked like. Uneven lengths, and mostly
// thrown up across the face, since Tycho sits low on the disc.
const TYCHO = { x: -0.11, y: 0.6, r: 0.05 }
const TYCHO_RAYS = [
  [-2.5, 1.05, 0.05],
  [-2.05, 0.72, 0.04],
  [-1.62, 1.3, 0.058],
  [-1.2, 0.88, 0.042],
  [-0.75, 1.12, 0.05],
  [-0.3, 0.58, 0.034],
  [0.5, 0.44, 0.03],
  [2.6, 0.5, 0.032],
]

const lerp = (a, b, t) => a + (b - a) * t
const rgbLerp = (a, b, t) =>
  `${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))}`

// Moonlight, cold overhead and warm at the horizon (see `warm` in drawMoon).
const MOON_COOL_DIM = [120, 119, 150]
const MOON_COOL_BRIGHT = [186, 184, 214]
const MOON_WARM_DIM = [138, 100, 92]
const MOON_WARM_BRIGHT = [228, 176, 136]
const HALO_COOL = [188, 186, 224]
const HALO_WARM = [230, 168, 122]

// opts:
//   limbAngle — where the lit edge really points (moonBrightLimb), radians CCW
//     from up. Null leaves the moon upright, the old fallback look.
//   warm — 0..1, how low the moon is: 0 rides high and cold, 1 sits on the
//     horizon, seen through a long slant of atmosphere that reddens it and
//     spreads its glow. Same physics as the twilight wash.
//   reveal — 0..1, how far a pinch has leaned in; blooms the halo and brings
//     up the fine detail that's too small to read at rest.
export function drawMoon(ctx, cx, cy, r, phase, alpha, opts = {}) {
  const { limbAngle = null, warm = 0, reveal = 0 } = opts
  if (alpha <= 0.002) return
  ctx.save()
  ctx.globalAlpha = alpha

  // faint halo — wider and warmer down at the horizon, blooming under a pinch
  const haloR = r * (2.6 + warm * 0.85 + reveal * 1.2)
  const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, haloR)
  halo.addColorStop(0, `rgba(${rgbLerp(HALO_COOL, HALO_WARM, warm)},${0.07 + warm * 0.05 + reveal * 0.05})`)
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  const waxing = phase <= 0.5
  const ellipseW = r * Math.cos(phase * 2 * Math.PI)
  // illuminated fraction, straight from the phase — 0 new, 1 full
  const frac = (1 - Math.cos(phase * 2 * Math.PI)) / 2

  // Turn the whole disc so the bright limb points where it really does
  // tonight. The figure below is built with its lit edge to the RIGHT when
  // waxing (to the LEFT when waning) — a bright-limb angle of ∓90° from
  // straight up — so we rotate by the difference from there. `ctx.rotate` is
  // clockwise-positive while limbAngle is counter-clockwise-positive, hence
  // the negation. The maria turn with it, as they must: the parallactic angle
  // tilts the entire face, not just the shadow — which is why the man in the
  // moon lies on his side by moonset.
  if (limbAngle != null) {
    const base = waxing ? -Math.PI / 2 : Math.PI / 2
    ctx.translate(cx, cy)
    ctx.rotate(-(limbAngle - base))
    ctx.translate(-cx, -cy)
  }

  // earthshine (dark side) — barely visible, so a crescent still reads as a
  // crescent, not a full grey disc with a bright edge
  ctx.fillStyle = 'rgba(42,40,62,0.28)'
  ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3)

  // The lit face, bounded by the terminator ellipse. Traced as a helper
  // because it's needed three times over: to fill, and then to clip the
  // terminator's softening and Tycho's rays to the daylit side only.
  const ew = Math.max(0.001, Math.abs(ellipseW))
  const litPath = () => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing)
    ctx.ellipse(cx, cy, ew, r, 0, Math.PI / 2, -Math.PI / 2, ellipseW > 0 ? waxing : !waxing)
    ctx.closePath()
  }

  // a photometric gradient: brightest at the limb, dimming toward the
  // terminator, as on a real sphere
  const brightX = waxing ? cx + r : cx - r
  const termX = waxing ? cx - r : cx + r
  const lit = ctx.createLinearGradient(termX, 0, brightX, 0)
  lit.addColorStop(0, `rgba(${rgbLerp(MOON_COOL_DIM, MOON_WARM_DIM, warm)},1)`)
  lit.addColorStop(1, `rgba(${rgbLerp(MOON_COOL_BRIGHT, MOON_WARM_BRIGHT, warm)},1)`)
  litPath()
  ctx.fillStyle = lit
  ctx.fill()

  // Soften the terminator. A real day/night line is not a knife edge — it's
  // the one place on the moon where the sun is at the horizon, a ragged band
  // of long shadows and grazing light. Blurred by hand: the terminator arc
  // (only that half of the ellipse — stroking the whole thing would lay a
  // second, false line across the lit face of a gibbous moon) stroked a few
  // times, widening and fading, clipped to the lit side so the shadow keeps
  // its own edge.
  ctx.save()
  litPath()
  ctx.clip()
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    ctx.strokeStyle = `rgba(20,19,32,${0.3 * (1 - t)})`
    ctx.lineWidth = r * (0.03 + t * 0.17)
    ctx.beginPath()
    ctx.ellipse(cx, cy, ew, r, 0, Math.PI / 2, -Math.PI / 2, ellipseW > 0 ? waxing : !waxing)
    ctx.stroke()
  }
  ctx.restore()

  // the maria, over the whole disc (soft, uneven, dark seas)
  for (const [mx, my, mrx, mry, mrot, md] of MARIA) {
    ctx.save()
    ctx.translate(cx + mx * r, cy + my * r)
    ctx.rotate(mrot)
    ctx.scale(mrx * r, mry * r) // a unit circle, stretched into the sea's real shape
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, `rgba(36,34,56,${md})`)
    g.addColorStop(0.6, `rgba(36,34,56,${md * 0.74})`)
    g.addColorStop(1, 'rgba(36,34,56,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Tycho and its rays — only on the lit side, and only really there near full
  const rayA = Math.pow(frac, 2.6) * (0.05 + reveal * 0.04)
  if (rayA > 0.003) {
    ctx.save()
    litPath()
    ctx.clip()
    ctx.globalCompositeOperation = 'lighten' // overlapping rays take the brighter
    // value rather than stacking into a hot seam where they cross
    const tx = cx + TYCHO.x * r
    const ty = cy + TYCHO.y * r
    for (const [a, len, wid] of TYCHO_RAYS) {
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(a)
      ctx.translate(r * len * 0.5, 0) // push the smudge out clear of the crater
      ctx.scale(r * len * 0.5, r * wid) // a unit circle drawn out along the ray
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, `rgba(226,224,246,${rayA})`)
      g.addColorStop(1, 'rgba(226,224,246,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const cg = ctx.createRadialGradient(tx, ty, 0, tx, ty, TYCHO.r * r * 2)
    cg.addColorStop(0, `rgba(232,230,250,${Math.min(1, rayA * 1.6)})`)
    cg.addColorStop(1, 'rgba(232,230,250,0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(tx, ty, TYCHO.r * r * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // limb darkening — a shaded rim so it reads as a sphere, not a disc
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
  limb.addColorStop(0, 'rgba(0,0,12,0)')
  limb.addColorStop(1, 'rgba(0,0,14,0.3)')
  ctx.fillStyle = limb
  ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3)

  ctx.restore()
  ctx.restore()
}

// A tiny flat silhouette of the moon at its real phase — for icon-sized use
// (the Home screen's quiet teaser), where drawMoon's gradients/maria/halo
// would just read as mud at a few pixels. Same terminator-ellipse
// construction as drawMoon, just flatly filled: a dim full disc (a hint of
// earthshine) with the true lit crescent/gibbous over it.
export function drawMoonGlyph(ctx, cx, cy, r, phase, litColor, shadowAlpha = 0.32) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`
  ctx.fill()

  const waxing = phase <= 0.5
  const ellipseW = r * Math.cos(phase * 2 * Math.PI)
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing)
  ctx.ellipse(cx, cy, Math.abs(ellipseW), r, 0, Math.PI / 2, -Math.PI / 2, ellipseW > 0 ? waxing : !waxing)
  ctx.closePath()
  ctx.fillStyle = litColor
  ctx.fill()
  ctx.restore()
}

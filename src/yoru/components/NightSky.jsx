import { useEffect, useRef, useState } from 'react'
import {
  moonPhase,
  moonPosition,
  moonPlacement,
  moonBrightLimb,
  moonArc,
  moonOnArc,
  twilight,
  drawMoon,
  drawMoonArc,
  drawSkyBackdrop,
  drawTwilight,
  extinction,
  makeFuji,
  drawFuji,
  makeMilkyWay,
  drawMilkyWay,
  meteorShower,
  starPosition,
  skyToScreen,
  starColor,
  season,
} from '../lib/sky'
import styles from './NightSky.module.css'

// The "Go dark" backdrop: a near-black sky with slowly drifting, realistically
// coloured and sized GENERIC stars (no constellations), a wispy Milky Way band
// — the sky's main "space filler," giving it weight even when the moon isn't
// up — the real moon at tonight's true phase, place and tilt, Mount Fuji rising
// from the lower centre, meteors that follow the real shower calendar, and
// season-aware drifting elements — sakura (spring), fireflies (summer), momiji
// (autumn), snow (winter). Deliberately very dim.
//
// It also answers to touch, on one rule: THE SKY OPENS TOWARD YOU. Rest a
// finger on it and the field swells and stirs under your hand; pinch and it
// leans in toward the moon. Both are the same idea at different scales, both
// brighten the whole sky while they last (`attention` below), and both let go
// and settle back on their own — so neither can strand you somewhere odd at
// 2am. Nothing is drawn to advertise either one; a plain tap still just peeks,
// which the parent handles.
export default function NightSky({ coords, moonPath: showMoonPath = true, starReveal = true, geoStatus, onRequestLocation }) {
  const canvasRef = useRef(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords
  const showMoonPathRef = useRef(showMoonPath)
  showMoonPathRef.current = showMoonPath
  const starRevealRef = useRef(starReveal)
  starRevealRef.current = starReveal

  // A manual "enable location" prompt — normally geolocation is requested
  // automatically and this never appears, but some contexts (installed/
  // standalone PWA windows, in particular) have been seen to silently drop
  // that automatic request with no native prompt and no error either. Wait
  // out a full attempt (the request itself times out at 8s) before offering
  // it, so an ordinary grant never flashes it.
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (coords) {
      setShowHint(false)
      return undefined
    }
    if (geoStatus === 'denied' || geoStatus === 'unavailable') {
      setShowHint(true)
      return undefined
    }
    const t = setTimeout(() => setShowHint(true), 8000)
    return () => clearTimeout(t)
  }, [coords, geoStatus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0

    let fuji = null
    let milkyWay = null
    let rect = canvas.getBoundingClientRect() // cached: pointermove must not re-measure
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fuji = makeFuji(w, h)
      milkyWay = makeMilkyWay(w, h)
      rect = canvas.getBoundingClientRect()
    }
    resize()
    window.addEventListener('resize', resize)

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const which = season()

    // ── Stars ────────────────────────────────────────────────────────────
    // A realistic population where size, brightness AND colour all follow one
    // magnitude, so each star stays physically coherent: bright ⇒ bigger and
    // more colourful. Crucially only the brightest carry a visible tint — that
    // is how night vision actually works, the eye's rods being colour-blind, so
    // faint stars read as neutral grey and only a Sirius or a Betelgeuse shows
    // its colour. (Before, every star was tinted but so dim over near-black
    // that the whole lovingly-built palette collapsed to the same grey.)
    const NEUTRAL = 224 // the colourless grey that faint stars settle toward
    const makeStar = (opts = {}) => {
      const [cr, cg, cb] = starColor()
      const mag = opts.mag ?? Math.random() ** 1.7 // 0..1, skewed faint
      const sat = opts.sat ?? Math.max(0, (mag - 0.55) / 0.45) ** 1.4
      const mix = (c) => Math.round(NEUTRAL + (c - NEUTRAL) * sat)
      return {
        x: opts.x ?? Math.random(),
        y: opts.y ?? Math.random(),
        r: opts.r ?? 0.3 + mag * 1.5,
        color: `${mix(cr)},${mix(cg)},${mix(cb)}`,
        base: opts.base ?? 0.05 + mag * 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: opts.speed ?? 0.3 + Math.random() * 0.6,
        drift: opts.drift ?? 0.0018 + Math.random() * 0.0028,
        halo: opts.halo ?? 0, // >0 only for the bright anchor stars below
      }
    }

    const stars = Array.from({ length: 160 }, () => makeStar())

    // A few first-magnitude "anchor" stars: markedly brighter, fully coloured
    // (bright enough for the eye to actually see the tint), each wrapped in a
    // soft atmospheric halo. They give the gaze somewhere to land and rest —
    // the settling stare that helps sleep — without adding clutter. Kept to the
    // upper sky, off the very edges and clear of the Fuji band lower down.
    stars.push(
      ...Array.from({ length: 5 }, () =>
        makeStar({
          x: 0.12 + Math.random() * 0.76,
          y: 0.05 + Math.random() * 0.45,
          r: 1.5 + Math.random() * 0.8,
          base: 0.45 + Math.random() * 0.27,
          sat: 0.85 + Math.random() * 0.15, // clearly coloured, a hint of white
          speed: 0.25 + Math.random() * 0.3, // slow, stately twinkle
          drift: 0.0014 + Math.random() * 0.0012,
          halo: 4 + Math.random() * 2.5,
        }),
      ),
    )

    // ── Touch: how the sky answers ───────────────────────────────────────
    // One field, sampled by everything that hangs in the sky — the ordinary
    // stars AND the Milky Way's speckles — so a stir moves all of it together
    // instead of leaving half the sky conspicuously nailed down. Returns, for
    // any point: `bump`, extra brightness, and `ox`/`oy`, a render-time offset.
    //
    // The offset is deliberately never written back into a star's own x/y: the
    // displacement lives only in the drawing, so when `stirEnergy` decays the
    // field returns to exactly where it started. Nothing to reset, nothing that
    // can drift out of place over a 90-minute session.
    const SWELL_R = 150 // px — how far the swell under your finger reaches
    const SWIRL_PX = 16 // px — how far it drags the field around
    const RIPPLE_SPEED = 260 // px/s — how fast a ring travels out
    const RIPPLE_BAND = 46 // px — the ring's thickness
    const RIPPLE_LIFE = 2.6 // s
    const STIR_RISE = 0.6 // s to full swell
    const STIR_FALL = 1.6 // s to settle back
    const MAX_ZOOM = 3.6
    const HOLD_MS = 350 // hold past this and it's a stir, not a tap
    const MOVE_PX = 12 // …or move past this, whichever comes first

    let stirOn = false
    let stirEnergy = 0
    let stirX = 0
    let stirY = 0
    let stirTargetX = 0
    let stirTargetY = 0
    let ripples = []
    let lastRippleAt = 0

    const field = {
      sample(x, y) {
        let bump = 0
        let ox = 0
        let oy = 0
        if (stirEnergy > 0.002) {
          const dx = x - stirX
          const dy = y - stirY
          const d2 = dx * dx + dy * dy
          const f = Math.exp(-d2 / (2 * SWELL_R * SWELL_R))
          bump += stirEnergy * f * 0.9
          if (!reduced) {
            // A slow turn about the finger with a little draw inward — the way
            // still water goes round a spoon rather than simply toward it.
            const d = Math.sqrt(d2) || 1
            const s = stirEnergy * f * SWIRL_PX
            ox += (-dy / d) * s - (dx / d) * s * 0.25
            oy += (dx / d) * s - (dy / d) * s * 0.25
          }
        }
        for (const rp of ripples) {
          const radius = rp.t * RIPPLE_SPEED
          const e = (Math.hypot(x - rp.x, y - rp.y) - radius) / RIPPLE_BAND
          if (e * e > 12) continue // far off the ring — skip the exp
          bump += Math.exp(-(e * e) / 2) * rp.strength * Math.max(0, 1 - rp.t / RIPPLE_LIFE)
        }
        return { bump, ox, oy }
      },
    }

    // ── The view: a pinch leans in toward the moon ───────────────────────
    // One uniform transform over the whole scene, so nothing can drift out of
    // register with anything else: the moon stays exactly on its arc, Fuji
    // keeps whatever the moon was doing behind it.
    let zoom = 1
    let zoomTarget = 1
    let zoomHoldUntil = 0
    let pinching = false
    let pinchStartDist = 0
    let pinchStartZoom = 1
    let focusLocked = null // where to lean in when the moon isn't up to lean toward
    let viewFx = 0
    let viewFy = 0
    let viewDx = 0
    let viewDy = 0

    const applyView = () => {
      const t = (zoom - 1) / (MAX_ZOOM - 1)
      // the focus glides to the centre of the frame as the zoom comes in
      viewDx = viewFx + (w / 2 - viewFx) * t
      viewDy = viewFy + (h / 2 - viewFy) * t
      ctx.translate(viewDx, viewDy)
      ctx.scale(zoom, zoom)
      ctx.translate(-viewFx, -viewFy)
    }
    // screen px → scene px, the inverse of the above. At rest (zoom 1) this is
    // the identity, so an un-pinched sky needs no special case anywhere.
    const toScene = (sx, sy) => ({ x: (sx - viewDx) / zoom + viewFx, y: (sy - viewDy) / zoom + viewFy })

    // ── Pointers ─────────────────────────────────────────────────────────
    // `consumed` is the whole of the gesture/tap negotiation: a quick tap never
    // sets it and so bubbles up to the parent's tap-to-peek untouched, while a
    // hold, a drag or a pinch swallows the click it would otherwise turn into.
    const pointers = new Map()
    let downAt = 0
    let downX = 0
    let downY = 0
    let moved = false
    let consumed = false

    const pinchPair = () => [...pointers.values()]
    const pinchDist = () => {
      const [a, b] = pinchPair()
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const onDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety; the gesture still works without it */
      }
      if (pointers.size === 1) {
        consumed = false // a fresh touch always starts out able to be a plain tap
        downAt = performance.now()
        downX = e.clientX
        downY = e.clientY
        moved = false
        const p = toScene(e.clientX - rect.left, e.clientY - rect.top)
        stirX = p.x // no easing in from wherever the last stir ended
        stirY = p.y
        stirTargetX = p.x
        stirTargetY = p.y
        stirOn = true
        lastRippleAt = 0
      } else if (pointers.size === 2) {
        // two fingers is a pinch, not a stir — don't try to be both at once
        stirOn = false
        pinching = true
        pinchStartDist = pinchDist()
        pinchStartZoom = zoomTarget
        consumed = true
        const [a, b] = pinchPair()
        focusLocked = toScene((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
      }
    }

    const onMove = (e) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pinching && pointers.size >= 2) {
        if (pinchStartDist > 8) {
          zoomTarget = Math.min(MAX_ZOOM, Math.max(1, pinchStartZoom * (pinchDist() / pinchStartDist)))
        }
        return
      }
      if (pointers.size !== 1) return
      if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_PX) moved = true
      const s = toScene(e.clientX - rect.left, e.clientY - rect.top)
      stirTargetX = s.x
      stirTargetY = s.y
    }

    const onUp = (e) => {
      pointers.delete(e.pointerId)
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* already gone */
      }
      if (pinching && pointers.size < 2) {
        pinching = false
        zoomHoldUntil = performance.now() + 1400 // let it hang there a moment before drifting home
      }
      if (pointers.size === 0) stirOn = false
    }

    // Swallow the click a consumed gesture would otherwise become, so the
    // parent's tap-to-peek doesn't fire on top of it. A native listener here
    // stops the event before it ever reaches React's root, where the parent's
    // onClick actually lives.
    const onClick = (e) => {
      if (!consumed) return
      e.stopPropagation()
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('click', onClick)

    // Season-aware drifting elements.
    const parts = []
    let lastSpawn = 0
    const SPAWN = { spring: 2600, autumn: 1700, winter: 360 }
    const MAX = { spring: 5, autumn: 8, winter: 48 }
    const AUTUMN = ['#c65b3c', '#d98a3a', '#c7a03c']

    const spawnFalling = () => {
      const x = Math.random() * w
      if (which === 'winter') {
        return { kind: 'snow', x, y: -10, vx: 0, vy: 18 + Math.random() * 22, size: 1.3 + Math.random() * 1.3, phase: Math.random() * Math.PI * 2, sway: 8 + Math.random() * 10, alpha: 0.3 + Math.random() * 0.35 }
      }
      if (which === 'autumn') {
        return { kind: 'leaf', x, y: -16, vx: -8 - Math.random() * 12, vy: 14 + Math.random() * 14, size: 5 + Math.random() * 4, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 2, color: AUTUMN[(Math.random() * AUTUMN.length) | 0], alpha: 0.2 + Math.random() * 0.16 }
      }
      // spring — sakura
      return { kind: 'sakura', x, y: -16, vx: -6 - Math.random() * 10, vy: 10 + Math.random() * 14, size: 5 + Math.random() * 5, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 1.2, alpha: 0.12 + Math.random() * 0.14 }
    }

    // Summer — a fixed population of blinking fireflies (hotaru) that hover and
    // wander near a home point, rather than travel anywhere — real hotaru drift
    // and loop in place over the grass, they don't climb or take flight. Kept
    // low, around Fuji's silhouette — a bit below its snow-capped top down to
    // near its base — never up among the stars. Only four: unlike the other
    // seasons' elements (which fall through the whole frame and leave), these
    // stay on screen the entire session AND are confined to a much smaller
    // area (just the Fuji band, not the full width and height) — so the same
    // raw count reads as far denser per unit of area than it would spread out.
    if (which === 'summer' && !reduced) {
      const fireflyMinY = fuji.peakY + h * 0.03
      const fireflyMaxY = fuji.baseY - h * 0.04
      for (let i = 0; i < 4; i++) {
        const homeX = Math.random() * w
        const homeY = fireflyMinY + Math.random() * (fireflyMaxY - fireflyMinY)
        parts.push({
          kind: 'firefly',
          homeX,
          homeY,
          x: homeX,
          y: homeY,
          t: Math.random() * 40, // stagger so they don't all wander in lockstep
          ampX: 20 + Math.random() * 16,
          ampY: 16 + Math.random() * 14,
          perX: 7 + Math.random() * 5, // seconds per loop, x-axis
          perY: 9 + Math.random() * 6, // different from perX → an organic
          // Lissajous-style loop, not a simple repeating ellipse
          size: 1.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          blink: 0.5 + Math.random() * 0.7,
        })
      }
    }

    // ── Meteors ──────────────────────────────────────────────────────────
    // Sporadics — the rare quiet surprise — are the baseline and are left
    // exactly as they were. On the real shower nights they're joined by the
    // shower's own, which don't wander in from anywhere: they stream away from
    // the radiant, and only while it's actually risen. Which shower (if any)
    // is a date question, so it's refreshed on a slow timer rather than per
    // frame — a session can cross midnight.
    let showerInfo = meteorShower(new Date())
    let lastShowerAt = performance.now()

    // The shower's state right now, or null on an ordinary night / with the
    // radiant still down. `mult` scales the meteor RATE; a radiant low to the
    // horizon throws few because most of its meteors are below the ground.
    const showerNow = (now2) => {
      if (!showerInfo || !coordsRef.current) return null
      const rp = starPosition(now2, coordsRef.current, showerInfo.shower.ra, showerInfo.shower.dec)
      if (!rp || rp.altitude <= 8) return null
      const altF = Math.min(1, rp.altitude / 40)
      return { mult: 1 + (showerInfo.shower.rate - 1) * showerInfo.strength * altF, at: skyToScreen(rp) }
    }

    let meteor = null
    let trains = []
    let nextMeteorAt = performance.now() + 6000 + Math.random() * 14000

    const scheduleMeteor = (now, now2) => {
      const s = showerNow(now2)
      nextMeteorAt = now + (12000 + Math.random() * 30000) / (s ? s.mult : 1)
    }

    // A meteor must burn out IN the sky. A real one flares across a good arc of
    // it and is gone, but it never leaves your view — the sky has no edges.
    // This frame does, so the flight is sized to fit inside it: at the speeds
    // used before, a meteor covered up to 780px of a 430px-wide screen and had
    // usually left the frame entirely before the terminal flare fired, which
    // meant the best moment of it was reliably drawn where nobody could see it.
    const METEOR_MARGIN = 6
    const BASE_Y = 0.88 // no meteors down in Fuji's band
    const inFrame = (x, y) => x > METEOR_MARGIN && x < w - METEOR_MARGIN && y > METEOR_MARGIN && y < h * BASE_Y

    const makeMeteor = (x, y, angle, speed, maxLife, len) => ({
      x,
      y,
      x0: x,
      y0: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len,
      life: 0,
      maxLife,
      // How hard it flares out at the end. A real meteor doesn't fade evenly —
      // it burns brightest as it breaks up, right before it's gone.
      flare: 0.35 + Math.random() * 0.65,
    })

    const spawnMeteor = (now2) => {
      const speed = 420 + Math.random() * 280
      const maxLife = 0.45 + Math.random() * 0.25
      const travel = speed * maxLife
      const s = showerNow(now2)
      if (s && s.at && Math.random() < 0.8) {
        // A shower meteor: somewhere out from the radiant, flying directly away
        // from it. The start is pinned to the radiant, so the only way to keep
        // the flight on screen is to try a few and take the first that fits.
        const rx = s.at.x * w
        const ry = s.at.y * h
        for (let i = 0; i < 12; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist = (0.12 + Math.random() * 0.5) * Math.min(w, h)
          const x = rx + Math.cos(angle) * dist
          const y = ry + Math.sin(angle) * dist
          if (!inFrame(x, y)) continue
          if (!inFrame(x + Math.cos(angle) * travel, y + Math.sin(angle) * travel)) continue
          // Meteors near the radiant are coming almost straight at you, so they
          // barely streak; the further out, the longer the trail.
          return makeMeteor(x, y, angle, speed, maxLife, 24 + (dist / Math.min(w, h)) * 110)
        }
        return null // the radiant's corner of the sky is off-frame tonight
      }
      // A sporadic — no radiant, no allegiance. Its start is free, so rather
      // than retrying blind, solve directly for the band of starting points
      // whose whole flight lands inside the frame.
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5
      const dx = Math.cos(angle) * travel
      const dy = Math.sin(angle) * travel
      const xlo = Math.max(METEOR_MARGIN, METEOR_MARGIN - dx)
      const xhi = Math.min(w - METEOR_MARGIN, w - METEOR_MARGIN - dx)
      const ylo = Math.max(METEOR_MARGIN, METEOR_MARGIN - dy)
      const yhi = Math.min(h * BASE_Y, h * BASE_Y - dy)
      if (xhi <= xlo || yhi <= ylo) return null // no room for a flight this long
      return makeMeteor(
        xlo + Math.random() * (xhi - xlo),
        ylo + Math.random() * (yhi - ylo),
        angle,
        speed,
        maxLife,
        50 + Math.random() * 40,
      )
    }

    let raf = 0
    let last = performance.now()
    // For the star "settle": the field swells up to greet you, then eases back
    // to its deep-dim resting state. Time-based from mount. The rise is delayed
    // to ~RISE_S because the sky sits in a container that fades its own opacity
    // in over 2.5s (`.veil`) — peaking any sooner would just be hidden behind
    // that fade. PEAK is the extra brightness multiplier at the crest (so a
    // resting 0.2-alpha star briefly blazes near full), deliberately strong so
    // the greeting is unmistakable, then it decays away over SETTLE_S.
    const startTime = performance.now()
    const RISE_S = 3.5
    const SETTLE_S = 34
    const PEAK = 2.8
    let moonArcData = null
    let lastArcAt = 0

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const now2 = new Date() // real wall-clock time, for everything real-astronomy below

      // ── touch state ────────────────────────────────────────────────────
      if (pointers.size === 1 && !consumed && (moved || now - downAt > HOLD_MS)) consumed = true
      if (stirOn) stirEnergy = Math.min(1, stirEnergy + dt / STIR_RISE)
      else stirEnergy = Math.max(0, stirEnergy - dt / STIR_FALL)
      // the swirl's centre trails the finger a little — water has weight
      stirX += (stirTargetX - stirX) * Math.min(1, dt * 9)
      stirY += (stirTargetY - stirY) * Math.min(1, dt * 9)
      // Rings only once the touch has committed (held past HOLD_MS, or moved),
      // so a tap that's on its way to a peek doesn't drop one and vanish.
      if (stirOn && consumed && !reduced && now - lastRippleAt > 420) {
        ripples.push({ x: stirX, y: stirY, t: 0, strength: lastRippleAt === 0 ? 0.85 : 0.5 })
        lastRippleAt = now
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].t += dt
        if (ripples[i].t > RIPPLE_LIFE) ripples.splice(i, 1)
      }
      if (!pinching && now > zoomHoldUntil) zoomTarget += (1 - zoomTarget) * Math.min(1, dt * 0.9)
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 7)
      const reveal = Math.max(0, (zoom - 1) / (MAX_ZOOM - 1))
      // The one rule both gestures share: touch the sky and it opens toward you.
      const attention = Math.max(stirEnergy, reveal)

      // ── tonight's astronomy, resolved before anything is drawn ──────────
      // The arc is computed whenever there's a location, even when it isn't
      // being drawn: the moon takes its x from the arc (see moonOnArc), so
      // deriving it only when the path is visible would make the moon jump
      // sideways the moment you turned the path off. What the toggle hides is
      // the drawing of it, nothing else.
      if (coordsRef.current) {
        if (!moonArcData || now - lastArcAt > 5 * 60000 || now2.getTime() > moonArcData.setAt) {
          lastArcAt = now
          moonArcData = moonArc(now2, coordsRef.current)
        }
      } else {
        moonArcData = null
      }
      if (now - lastShowerAt > 5 * 60000) {
        lastShowerAt = now
        showerInfo = meteorShower(now2)
      }

      const { phase, fraction } = moonPhase(now2)
      const mpos = moonPosition(now2, coordsRef.current)
      const place = moonOnArc(now2, coordsRef.current, moonArcData) || moonPlacement(mpos)
      const limbAngle = moonBrightLimb(now2, coordsRef.current)
      // How low the moon is riding, 0..1 — the long slant of atmosphere that
      // reddens it and spreads its glow. Unknown without a location, and a
      // guess would be worse than nothing, so: cold.
      const warm = mpos && mpos.altitude > 0 ? Math.max(0, 1 - mpos.altitude / 20) : 0
      // The moon's actual output — what it has to light Fuji with.
      const moonlight = fraction * place.presence

      // lean in toward the moon; failing that, toward wherever you pinched
      viewFx = place.x * w
      viewFy = place.y * h
      if (place.presence <= 0.05 && focusLocked) {
        viewFx = focusLocked.x
        viewFy = focusLocked.y
      }

      // ── draw ───────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h)
      drawSkyBackdrop(ctx, w, h) // untransformed: it must cover the frame at any zoom

      ctx.save()
      applyView()

      // twilight — a low horizon wash tracking the real sun, drawn first so it
      // sits behind absolutely everything else (stars, Milky Way, the moon and
      // its arc all layer over it undimmed). Cheap enough (one trig call, no
      // scan) to compute fresh every frame, same as the moon's own phase below.
      drawTwilight(ctx, twilight(now2, coordsRef.current), w, h)

      // the Milky Way — a soft backdrop texture, stars scattered on top of it
      if (milkyWay) drawMilkyWay(ctx, milkyWay, h, field, zoom)

      // the moon's arc — drawn here so it sits IN FRONT OF the Milky Way but
      // BEHIND the stars and the moon: a faint guide in the deep sky, not a
      // foreground mark. The moon's own disc is cut out of it (see drawMoonArc):
      // the moon sits ON the arc and is drawn half-transparent, so the dots
      // would otherwise show through its face.
      const mr = Math.min(w, h) * 0.11
      if (showMoonPathRef.current) {
        const hide = place.presence > 0 ? { x: place.x * w, y: place.y * h, r: mr * 1.1 } : null
        drawMoonArc(ctx, moonArcData, w, h, hide)
      }

      // stars. `boost` is the settle: the field swells from rest up to 1+PEAK
      // over the first RISE_S, then eases back to 1 across SETTLE_S — the sky
      // greets you brightly, then quiets, reinforcing the wind-down (never
      // busier as time passes). Off (toggle, or reduced-motion) means boost
      // stays 1 and the field simply opens already at rest. `attention` rides
      // on top of it either way: that one is your hand, not the clock.
      let boost = 1
      if (starRevealRef.current && !reduced) {
        const t = (now - startTime) / 1000
        let lift = t < RISE_S ? t / RISE_S : Math.max(0, 1 - (t - RISE_S) / SETTLE_S)
        lift = lift * lift * (3 - 2 * lift) // smoothstep — gentle in and out
        boost = 1 + lift * PEAK
      }
      boost *= 1 + attention * 0.9
      for (const s of stars) {
        if (!reduced) {
          s.phase += s.speed * dt
          s.y += s.drift * dt
          if (s.y > 1.05) s.y -= 1.1
        }
        const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(s.phase)
        const t = field.sample(s.x * w, s.y * h)
        const px = s.x * w + t.ox
        const py = s.y * h + t.oy
        const alpha = Math.min(1, s.base * tw * boost * extinction(py / h) * (1 + t.bump * 2.6))
        // Divided by `zoom` so leaning in spreads the stars apart without
        // fattening them. A star has no disc to magnify — even through a
        // telescope it stays a point, which is the whole reason planets look
        // like discs and stars never do. Scaling them with the view turned
        // them into chunky blobs, which read as dust on the lens.
        const r = (s.r * (1 + t.bump * 0.5)) / zoom
        // A soft atmospheric halo for the anchor stars, drawn under the core.
        if (s.halo) {
          const hr = r * s.halo
          ctx.globalAlpha = 1
          const g = ctx.createRadialGradient(px, py, 0, px, py, hr)
          g.addColorStop(0, `rgba(${s.color},${alpha * 0.45})`)
          g.addColorStop(1, `rgba(${s.color},0)`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(px, py, hr, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = `rgb(${s.color})`
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // meteors, and the trains the brightest of them leave hanging
      if (!reduced) {
        if (!meteor && now > nextMeteorAt) {
          meteor = spawnMeteor(now2)
          if (!meteor) scheduleMeteor(now, now2) // nothing to throw right now; try again later
        }
        if (meteor) {
          meteor.life += dt
          meteor.x += meteor.vx * dt
          meteor.y += meteor.vy * dt
          const t = meteor.life / meteor.maxLife
          if (t >= 1) {
            // A persistent train: the ionised trail the biggest ones leave
            // glowing for a second after the meteor itself has gone. Rare, and
            // only from the ones that really flared.
            if (meteor.flare > 0.75 && Math.random() < 0.5) {
              trains.push({ x0: meteor.x0, y0: meteor.y0, x1: meteor.x, y1: meteor.y, t: 0, life: 0.9 })
            }
            meteor = null
            scheduleMeteor(now, now2)
          } else {
            const speed = Math.hypot(meteor.vx, meteor.vy)
            const ux = meteor.vx / speed
            const uy = meteor.vy / speed
            const tx = meteor.x - ux * meteor.len
            const ty = meteor.y - uy * meteor.len
            const a = Math.sin(Math.PI * t) * 0.7
            const grad = ctx.createLinearGradient(tx, ty, meteor.x, meteor.y)
            grad.addColorStop(0, 'rgba(238,240,255,0)')
            grad.addColorStop(1, `rgba(238,240,255,${a})`)
            ctx.strokeStyle = grad
            ctx.lineWidth = 1.3
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(meteor.x, meteor.y)
            ctx.stroke()
            // the terminal flare — brightest as it breaks up, just before it goes
            const flare = meteor.flare * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.55) / 0.45)))
            if (flare > 0.01) {
              const hr = 2.2 + flare * 9
              const g = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, hr)
              g.addColorStop(0, `rgba(246,248,255,${Math.min(1, a + flare * 0.85)})`)
              g.addColorStop(0.4, `rgba(214,224,255,${Math.min(1, (a + flare) * 0.3)})`)
              g.addColorStop(1, 'rgba(190,206,255,0)')
              ctx.fillStyle = g
              ctx.beginPath()
              ctx.arc(meteor.x, meteor.y, hr, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
        for (let i = trains.length - 1; i >= 0; i--) {
          const tr = trains[i]
          tr.t += dt
          if (tr.t > tr.life) {
            trains.splice(i, 1)
            continue
          }
          const k = 1 - tr.t / tr.life
          const a = 0.16 * k * k
          const g = ctx.createLinearGradient(tr.x0, tr.y0, tr.x1, tr.y1)
          g.addColorStop(0, 'rgba(200,214,255,0)')
          g.addColorStop(0.5, `rgba(200,214,255,${a})`)
          g.addColorStop(1, 'rgba(200,214,255,0)')
          ctx.strokeStyle = g
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(tr.x0, tr.y0)
          ctx.lineTo(tr.x1, tr.y1)
          ctx.stroke()
        }
      }

      // the real moon — tonight's phase, place, and the tilt its lit edge
      // actually has. When it's up and we have its arc it sits exactly ON that
      // arc; otherwise the plain placement (the no-location decorative moon, or
      // an invisible below-horizon one).
      drawMoon(ctx, place.x * w, place.y * h, mr, phase, 0.5 * place.presence, { limbAngle, warm, reveal })

      // Mount Fuji — a static, dim silhouette rising from the lower centre, lit
      // by the moon itself: where it sits across the frame gives the light's
      // direction, its real altitude gives the light's elevation, and what it
      // has to give gives the strength.
      if (fuji) {
        drawFuji(ctx, fuji, { xFrac: place.x, altitude: mpos ? mpos.altitude : null, light: moonlight })
      }

      // season elements, in front of the landscape
      if (which !== 'summer' && !reduced && now - lastSpawn > SPAWN[which] && parts.length < MAX[which]) {
        parts.push(spawnFalling())
        lastSpawn = now
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        if (p.kind === 'firefly') {
          // A slow Lissajous wander around a fixed home point: always moving,
          // always organic, and never drifting away. (A velocity-based random
          // walk was tried first, but its push and drag nearly cancelled out at
          // typical frame rates, settling into well under a pixel/second of
          // drift — technically wandering, but imperceptible; this reads clearly
          // instead, driven directly by elapsed time rather than accumulated
          // velocity.)
          p.t += dt
          p.x = p.homeX + Math.sin((p.t / p.perX) * Math.PI * 2) * p.ampX
          p.y = p.homeY + Math.sin((p.t / p.perY) * Math.PI * 2 + 1.3) * p.ampY
          p.phase += p.blink * dt
          const s = Math.max(0, Math.sin(p.phase))
          const a = 0.08 + 0.55 * s * s
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
          g.addColorStop(0, `rgba(200,232,150,${a})`)
          g.addColorStop(0.4, `rgba(170,214,110,${a * 0.5})`)
          g.addColorStop(1, 'rgba(150,200,90,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y > h + 20 || p.x < -20) {
          parts.splice(i, 1)
          continue
        }
        if (p.kind === 'snow') {
          p.phase += dt
          const sx = p.x + Math.sin(p.phase) * p.sway
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = '#dfe4f2'
          ctx.beginPath()
          ctx.arc(sx, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          continue
        }
        // sakura petal or momiji leaf
        p.rot += p.vrot * dt
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.alpha
        if (p.kind === 'leaf') {
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.ellipse(0, 0, p.size * 0.42, p.size, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.18)'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(0, -p.size)
          ctx.lineTo(0, p.size)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#f4a8c4'
          ctx.beginPath()
          ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      ctx.globalAlpha = 1

      ctx.restore() // end of the pinch transform

      // A vignette that closes in as you lean toward the moon, so the edges of
      // the frame fall away instead of showing you a wall of stretched sky.
      if (reveal > 0.01) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.72)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, `rgba(0,0,0,${0.5 * reveal})`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className={styles.sky} aria-hidden="true" />
      {showHint && onRequestLocation && (
        <button
          type="button"
          className={styles.locationHint}
          onClick={(e) => {
            e.stopPropagation()
            onRequestLocation()
          }}
        >
          {geoStatus === 'denied'
            ? "location's blocked — allow it in your browser's site settings for the real moon"
            : 'enable location for the real moon'}
        </button>
      )}
    </>
  )
}

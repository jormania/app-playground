import { useEffect, useRef, useState } from 'react'
import {
  moonPhase,
  moonPosition,
  moonPlacement,
  moonArc,
  moonOnArc,
  drawMoon,
  drawMoonArc,
  makeFuji,
  drawFuji,
  makeMilkyWay,
  drawMilkyWay,
  starColor,
  starSize,
  season,
} from '../lib/sky'
import styles from './NightSky.module.css'

// The "Go dark" backdrop: a near-black sky with slowly drifting, realistically
// coloured and sized GENERIC stars (no constellations), a wispy Milky Way band
// — the sky's main "space filler," giving it weight even when the moon isn't
// up — the real moon at tonight's true phase and place, Mount Fuji rising from
// the lower centre, an occasional quiet meteor, and season-aware drifting
// elements — sakura (spring), fireflies (summer), momiji (autumn), snow
// (winter). Deliberately very dim. The parent handles tap-to-peek.
export default function NightSky({ coords, moonPath: showMoonPath = true, geoStatus, onRequestLocation }) {
  const canvasRef = useRef(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords
  const showMoonPathRef = useRef(showMoonPath)
  showMoonPathRef.current = showMoonPath

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
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fuji = makeFuji(w, h)
      milkyWay = makeMilkyWay(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const which = season()

    const stars = Array.from({ length: 160 }, () => {
      const [cr, cg, cb] = starColor()
      return {
        x: Math.random(),
        y: Math.random(),
        r: starSize(),
        color: `${cr},${cg},${cb}`,
        base: 0.05 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.6,
        drift: 0.0018 + Math.random() * 0.0028,
      }
    })

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

    // A rare shooting star — a quiet surprise, not a light show. One at a
    // time, long gaps between, gone in well under a second.
    let meteor = null
    let nextMeteorAt = performance.now() + 6000 + Math.random() * 14000
    const spawnMeteor = () => {
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.5
      const speed = 700 + Math.random() * 400
      return {
        x: w * (0.15 + Math.random() * 0.7),
        y: h * (0.05 + Math.random() * 0.2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 50 + Math.random() * 40,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.25,
      }
    }

    let raf = 0
    let last = performance.now()
    let moonArcData = null
    let lastArcAt = 0

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#04040a'
      ctx.fillRect(0, 0, w, h)

      // the Milky Way — a soft backdrop texture, stars scattered on top of it
      if (milkyWay) drawMilkyWay(ctx, milkyWay)

      // the moon's arc — drawn here so it sits IN FRONT OF the Milky Way but
      // BEHIND the stars and the moon: a faint guide in the deep sky, not a
      // foreground mark. Its shape (a full rise→set window) is stable for the
      // session, so it's recomputed only every few minutes, or once the cached
      // window has fully elapsed.
      if (showMoonPathRef.current && coordsRef.current) {
        if (!moonArcData || now - lastArcAt > 5 * 60000 || Date.now() > moonArcData.setAt) {
          lastArcAt = now
          moonArcData = moonArc(new Date(), coordsRef.current)
        }
        drawMoonArc(ctx, moonArcData, w, h)
      } else {
        moonArcData = null
      }

      // stars
      for (const s of stars) {
        if (!reduced) {
          s.phase += s.speed * dt
          s.y += s.drift * dt
          if (s.y > 1.05) s.y -= 1.1
        }
        const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(s.phase)
        ctx.globalAlpha = s.base * tw
        ctx.fillStyle = `rgb(${s.color})`
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // the rare shooting star
      if (!reduced) {
        if (!meteor && now > nextMeteorAt) meteor = spawnMeteor()
        if (meteor) {
          meteor.life += dt
          meteor.x += meteor.vx * dt
          meteor.y += meteor.vy * dt
          const t = meteor.life / meteor.maxLife
          if (t >= 1) {
            meteor = null
            nextMeteorAt = now + 12000 + Math.random() * 30000
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
          }
        }
      }

      // the real moon, at tonight's true phase and (with a location) its place.
      // When it's up and we have its arc, it sits exactly ON that arc; otherwise
      // it falls back to the plain placement (the no-location decorative moon,
      // or an invisible below-horizon one).
      const now2 = new Date()
      const { phase } = moonPhase(now2)
      const place =
        moonOnArc(now2, coordsRef.current, moonArcData) ||
        moonPlacement(moonPosition(now2, coordsRef.current))

      const mr = Math.min(w, h) * 0.11
      drawMoon(ctx, place.x * w, place.y * h, mr, phase, 0.5 * place.presence)

      // Mount Fuji — a static, dim silhouette rising from the lower centre
      if (fuji) drawFuji(ctx, fuji, place.x)

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

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
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

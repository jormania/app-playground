import { useEffect, useRef } from 'react'
import { moonPhase, moonPosition, moonPlacement, drawMoon, makeFuji, drawFuji, season } from '../lib/sky'
import styles from './NightSky.module.css'

// The "Go dark" backdrop: a near-black sky with slowly drifting, faintly
// twinkling GENERIC stars (no constellations), the real moon at tonight's true
// phase and place, Mount Fuji rising from the lower centre, and season-aware
// drifting elements — sakura (spring), fireflies (summer), momiji (autumn),
// snow (winter). Deliberately very dim. The parent handles tap-to-peek.
export default function NightSky({ coords }) {
  const canvasRef = useRef(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0

    let fuji = null
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fuji = makeFuji(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const which = season()

    const stars = Array.from({ length: 82 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.1,
      base: 0.05 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.6,
      drift: 0.0018 + Math.random() * 0.0028,
    }))

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
    // and loop in place over the grass, they don't climb or take flight.
    if (which === 'summer' && !reduced) {
      for (let i = 0; i < 12; i++) {
        const homeX = Math.random() * w
        const homeY = h * 0.25 + Math.random() * h * 0.6
        parts.push({
          kind: 'firefly',
          homeX,
          homeY,
          x: homeX,
          y: homeY,
          vx: 0,
          vy: 0,
          roam: 26 + Math.random() * 20, // how far it wanders from home
          size: 1.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          blink: 0.5 + Math.random() * 0.7,
        })
      }
    }

    let raf = 0
    let last = performance.now()

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#04040a'
      ctx.fillRect(0, 0, w, h)

      // stars
      for (const s of stars) {
        if (!reduced) {
          s.phase += s.speed * dt
          s.y += s.drift * dt
          if (s.y > 1.05) s.y -= 1.1
        }
        const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(s.phase)
        ctx.globalAlpha = s.base * tw
        ctx.fillStyle = '#eef0ff'
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // the real moon, at tonight's true phase and (with a location) its place
      const now2 = new Date()
      const { phase } = moonPhase(now2)
      const place = moonPlacement(moonPosition(now2, coordsRef.current))
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
          // Hover near home: a gentle random push each frame, plus a soft pull
          // back once it strays past its roam radius — no net drift in any
          // direction, so it loops and wanders in place rather than flying off.
          p.vx += (Math.random() - 0.5) * 12 * dt
          p.vy += (Math.random() - 0.5) * 12 * dt
          const ox = p.x - p.homeX
          const oy = p.y - p.homeY
          const dist = Math.sqrt(ox * ox + oy * oy)
          if (dist > p.roam) {
            const pull = (dist - p.roam) * 0.8
            p.vx -= (ox / dist) * pull * dt
            p.vy -= (oy / dist) * pull * dt
          }
          // gentle drag so it settles into slow loops instead of jittering
          p.vx *= 1 - 1.8 * dt
          p.vy *= 1 - 1.8 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
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

  return <canvas ref={canvasRef} className={styles.sky} aria-hidden="true" />
}

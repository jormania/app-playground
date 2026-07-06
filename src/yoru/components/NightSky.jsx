import { useEffect, useRef } from 'react'
import { moonPhase, moonPosition, moonPlacement, drawMoon } from '../lib/sky'
import styles from './NightSky.module.css'

// The "Go dark" backdrop: a near-black sky with a few slowly drifting, faintly
// twinkling GENERIC stars (no constellations), the real moon at tonight's true
// phase and — with a location — its true place in the sky, and the occasional
// cherry-blossom petal drifting down. Deliberately very dim — lovely if you open
// your eyes, never enough to light the room. Its parent handles tap-to-peek.
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

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const stars = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.1,
      base: 0.06 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.6,
      drift: 0.0015 + Math.random() * 0.002,
    }))

    const petals = []
    let lastPetal = 0

    const spawnPetal = () => ({
      x: Math.random() * w,
      y: -20,
      vx: -6 - Math.random() * 10,
      vy: 10 + Math.random() * 14,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.2,
      alpha: 0.12 + Math.random() * 0.14,
    })

    let raf = 0
    let last = performance.now()

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      ctx.clearRect(0, 0, w, h)
      // deep near-black wash
      ctx.fillStyle = '#04040a'
      ctx.fillRect(0, 0, w, h)

      // the real moon, at tonight's true phase and (with a location) its place
      const now2 = new Date()
      const { phase } = moonPhase(now2)
      const place = moonPlacement(moonPosition(now2, coordsRef.current))
      const mr = Math.min(w, h) * 0.11
      drawMoon(ctx, place.x * w, place.y * h, mr, phase, 0.5 * place.presence)

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

      // occasional sakura petals
      if (!reduced && now - lastPetal > 2600 && petals.length < 5) {
        petals.push(spawnPetal())
        lastPetal = now
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vrot * dt
        if (p.y > h + 20 || p.x < -20) {
          petals.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#f4a8c4'
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2)
        ctx.fill()
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

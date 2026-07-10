import { useEffect, useRef } from 'react'
import { moonPhase, drawMoonGlyph } from '../lib/sky'
import styles from './MoonGlyph.module.css'

// A tiny, quiet teaser of tonight's real moon phase, sitting beside the 夜
// glyph on Home — no location needed (phase alone is the same worldwide).
// Drawn once on mount: the phase moves far too slowly for Home's brief
// lifetime to warrant a refresh timer.
export default function MoonGlyph() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = canvas.clientWidth || 18
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { phase } = moonPhase(new Date())
    drawMoonGlyph(ctx, size / 2, size / 2, size / 2 - 1, phase, '#c8c4e8')
  }, [])

  return <canvas ref={canvasRef} className={styles.glyph} aria-hidden="true" />
}

import type { Finger, Hand } from '../../engine'
import styles from './journey.module.css'

// Two hands seen from above, as they rest on the keys, each finger with its
// number. Pianists number both hands from the thumb, so the hands mirror:
// 5 4 3 2 1 | 1 2 3 4 5. Drawn by hand in SVG, like the staff.

/** The right hand; the left is its mirror. x is the finger's centre at its base, angle its lean (degrees). */
const FINGERS: { n: Finger; x: number; base: number; length: number; width: number; angle: number }[] = [
  { n: 1, x: 27, base: 90, length: 42, width: 15, angle: -34 },
  { n: 2, x: 38, base: 62, length: 48, width: 14, angle: -4 },
  { n: 3, x: 54, base: 62, length: 56, width: 14, angle: 0 },
  { n: 4, x: 70, base: 62, length: 50, width: 14, angle: 3 },
  { n: 5, x: 85, base: 66, length: 40, width: 13, angle: 8 },
]
const PALM = { x: 28, y: 56, w: 68, h: 50 }
/** One hand's width; the left hand is drawn from 0, the right from HAND_W + GAP. */
const HAND_W = 104
const GAP = 16

const rad = (deg: number) => (deg * Math.PI) / 180

function HandShape({ hand, active }: { hand: Hand; active?: Finger }) {
  // The left hand mirrors the right about its own middle.
  const flip = hand === 'left'
  const ox = hand === 'left' ? 0 : HAND_W + GAP
  const X = (x: number) => ox + (flip ? HAND_W - x : x)
  return (
    <g className={styles.hand} data-hand={hand}>
      <rect x={ox + (flip ? HAND_W - PALM.x - PALM.w : PALM.x)} y={PALM.y} width={PALM.w} height={PALM.h} rx={20} className={styles.palm} />
      {FINGERS.map((f) => {
        const angle = flip ? -f.angle : f.angle
        const cx = X(f.x)
        const on = active === f.n
        // The fingertip's centre, for the number: up the finger, leaning with it.
        const d = f.length - f.width / 2 - 2
        const tx = cx + d * Math.sin(rad(angle))
        const ty = f.base - d * Math.cos(rad(angle))
        return (
          <g key={f.n} className={styles.finger} data-on={on || undefined}>
            <rect x={cx - f.width / 2} y={f.base - f.length} width={f.width} height={f.length + 8} rx={f.width / 2} transform={`rotate(${angle} ${cx} ${f.base})`} />
            <circle cx={tx} cy={ty} r={7.5} className={styles.fingerBadge} />
            <text x={tx} y={ty + 3.4} className={styles.fingerNumber}>
              {f.n}
            </text>
          </g>
        )
      })}
    </g>
  )
}

interface Props {
  /** The finger asked for, lit on its hand. */
  active?: { hand: Hand; finger: Finger }
  /** What a screen reader hears. */
  ariaLabel: string
  /** Under each hand: its name. */
  leftLabel: string
  rightLabel: string
}

export function Hands({ active, ariaLabel, leftLabel, rightLabel }: Props) {
  const width = HAND_W * 2 + GAP
  return (
    <svg className={styles.hands} viewBox={`0 0 ${width} 122`} role="img" aria-label={ariaLabel}>
      <HandShape hand="left" active={active?.hand === 'left' ? active.finger : undefined} />
      <HandShape hand="right" active={active?.hand === 'right' ? active.finger : undefined} />
      <text x={HAND_W / 2} y={119} className={styles.handName} data-on={active?.hand === 'left' || undefined}>
        {leftLabel}
      </text>
      <text x={HAND_W + GAP + HAND_W / 2} y={119} className={styles.handName} data-on={active?.hand === 'right' || undefined}>
        {rightLabel}
      </text>
    </svg>
  )
}

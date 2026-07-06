/** The Sol Odyssey compass — the bespoke brand mark, inlined so it TINTS with the active palette.
 *  The structure rides `--color-accent` (via currentColor), the north point + centre hub-dot use
 *  `--color-energy` (the accent/energy pairing used everywhere else), and the hub reads as the page
 *  canvas (`--color-background-primary`). The standalone /public SVG file stays fixed indigo — it's
 *  the favicon + PWA icon source, which live outside the themed surface. Keep the two in visual step. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden
      style={{ color: 'var(--color-accent)' }}
    >
      {/* outer ring */}
      <circle cx="256" cy="256" r="236" stroke="currentColor" strokeWidth="14" fill="none" />
      <circle cx="256" cy="256" r="210" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.4" />
      {/* cardinal ticks */}
      <g fill="currentColor">
        <rect x="250" y="34" width="12" height="34" rx="3" />
        <rect x="250" y="444" width="12" height="34" rx="3" />
        <rect x="34" y="250" width="34" height="12" rx="3" />
        <rect x="444" y="250" width="34" height="12" rx="3" />
      </g>
      {/* diagonal spokes */}
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.35">
        <line x1="256" y1="256" x2="157" y2="157" />
        <line x1="256" y1="256" x2="355" y2="157" />
        <line x1="256" y1="256" x2="157" y2="355" />
        <line x1="256" y1="256" x2="355" y2="355" />
      </g>
      {/* horizontal compass diamond (E–W), recessed for a two-tone read */}
      <polygon points="58,256 256,238 454,256 256,274" fill="currentColor" opacity="0.55" />
      {/* vertical compass diamond (N–S), the stronger axis */}
      <polygon points="256,58 274,256 256,454 238,256" fill="currentColor" opacity="0.9" />
      {/* north point — the bright beat */}
      <polygon points="256,58 274,256 238,256" style={{ fill: 'var(--color-energy)' }} />
      {/* centre hub — fill matches the page so it reads as a clean hole */}
      <circle
        cx="256"
        cy="256"
        r="26"
        style={{ fill: 'var(--color-background-primary)' }}
        stroke="currentColor"
        strokeWidth="8"
      />
      <circle cx="256" cy="256" r="9" style={{ fill: 'var(--color-energy)' }} />
    </svg>
  )
}

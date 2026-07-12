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
      {/* Background circle / halo */}
      <circle cx="256" cy="256" r="236" stroke="currentColor" strokeWidth="14" fill="none" opacity="0.4" />
      {/* Pillar base */}
      <rect x="120" y="400" width="272" height="40" rx="8" fill="currentColor" opacity="0.8" />
      <rect x="150" y="370" width="212" height="30" fill="currentColor" opacity="0.9" />
      {/* Columns */}
      <rect x="170" y="160" width="30" height="210" fill="currentColor" />
      <rect x="241" y="160" width="30" height="210" fill="currentColor" />
      <rect x="312" y="160" width="30" height="210" fill="currentColor" />
      {/* Pillar top (Capital) */}
      <rect x="150" y="130" width="212" height="30" fill="currentColor" opacity="0.9" />
      {/* Pediment (Triangle) */}
      <polygon points="256,60 120,130 392,130" style={{ fill: 'var(--color-energy)' }} />
      {/* Inner triangle detail */}
      <polygon points="256,80 150,120 362,120" style={{ fill: 'var(--color-background-primary)' }} />
      <polygon points="256,92 180,116 332,116" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

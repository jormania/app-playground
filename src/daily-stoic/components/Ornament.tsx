import { cn } from '../lib/cn';

interface OrnamentProps {
  className?: string;
  /** Diameter of the centre mark in px (default 12). */
  size?: number;
}

// A printer's ornament: two tapering hairlines meeting a small four-point star,
// the kind of rule an almanac sets between sections. Drawn as SVG (not a font
// glyph) so it renders identically on every device, and coloured via
// currentColor so it re-tints with whatever text tone it's placed in.
export default function Ornament({ className, size = 12 }: OrnamentProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-3 text-text-secondary', className)}
      aria-hidden="true"
    >
      <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-current opacity-50" />
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        {/* Four-point star: a slim diamond with concave sides. */}
        <path d="M12 0c.9 6.6 4.5 10.2 11.1 11.1v1.8C16.5 13.8 12.9 17.4 12 24c-.9-6.6-4.5-10.2-11.1-11.1v-1.8C7.5 10.2 11.1 6.6 12 0Z" />
      </svg>
      <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-current opacity-50" />
    </div>
  );
}

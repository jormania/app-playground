import { useMemo } from 'react';

/**
 * A tiny inline SVG sparkline that scales to its container.
 * `data` is an array of numbers.
 * `color` is a CSS color string.
 */
export default function Sparkline({ data, color, width = '100%', height = 40, strokeWidth = 2 }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // avoid divide by zero

    return data.map((val, idx) => {
      // x from 0 to 100
      const x = (idx / (data.length - 1)) * 100;
      // y from 0 to 100 (inverted because SVG y is down)
      const y = 100 - (((val - min) / range) * 100);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [data]);

  if (!data || data.length < 2) return null;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 -5 100 110" 
      preserveAspectRatio="none" 
      style={{ display: 'block', overflow: 'visible', opacity: 0.6, marginTop: 'var(--space-md)' }}
    >
      {/* Fill gradient below the line */}
      <defs>
        <linearGradient id={`gradient-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path 
        d={`${path} L 100 110 L 0 110 Z`} 
        fill={`url(#gradient-${color.replace(/[^a-zA-Z0-9]/g, '')})`} 
        stroke="none" 
      />
      
      {/* The line itself */}
      <path 
        d={path} 
        fill="none" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

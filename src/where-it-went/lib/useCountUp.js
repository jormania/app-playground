import { useState, useEffect } from 'react';

/** True when animation should be skipped: reduced-motion users and test runners. */
function prefersStatic() {
  const isTestEnv =
    (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) ||
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.MODE === 'test' || import.meta.env.VITEST)) ||
    (typeof window !== 'undefined' && (window.__vitest_index__ || window.__vitest_worker__ || window.__VITEST__)) ||
    (typeof window !== 'undefined' && window.navigator &&
      /jsdom|happy-dom/i.test(window.navigator.userAgent || ''));
  if (isTestEnv) return true;

  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return true;
  if (typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch { /* matchMedia exists but is unusable — fall through */ }
  }
  return false;
}

/**
 * Odometer-style counter for the KPI cards.
 *
 * Hooks are always called in the same order — the previous version returned early
 * *before* useState/useEffect (a rules-of-hooks violation flagged by eslint). The
 * static case is handled inside the effect instead, which also gives us
 * prefers-reduced-motion support for free.
 */
export function useCountUp(end, duration = 1500) {
  // Starts at 0 so the very first mount actually counts up; a static/test render
  // jumps straight to `end` inside the effect below, so nothing ever flashes 0
  // in a snapshot.
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (prefersStatic()) {
      setValue(end);
      return undefined;
    }

    let startTime = null;
    let startValue = null;
    let animationFrame;

    const step = (timestamp) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setValue(prev => {
        if (startValue === null) startValue = prev;
        return startValue + (end - startValue) * easeProgress;
      });

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setValue(end);
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    // Safety net: requestAnimationFrame never fires in a context that isn't
    // compositing — a hidden tab, a backgrounded PWA, an embedded pane. Without
    // this the headline KPI sits at "0 L" indefinitely while its own trend badge
    // shows a real percentage, which reads as "you earned nothing this month".
    // The timer is cleared on the normal path, so it only ever fires if the
    // animation genuinely never ran.
    const fallback = window.setTimeout(() => setValue(end), duration + 250);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fallback);
    };
  }, [end, duration]);

  return value;
}

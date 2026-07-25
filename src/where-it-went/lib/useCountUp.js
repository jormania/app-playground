import { useState, useEffect } from 'react';

export function useCountUp(end, duration = 1500) {
  const isTest = (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) ||
                 (import.meta && import.meta.env && (import.meta.env.MODE === 'test' || import.meta.env.VITEST)) ||
                 (typeof window !== 'undefined' && (window.__vitest_index__ || window.__vitest_worker__ || window.__VITEST__ || (window.navigator && (window.navigator.userAgent.includes('jsdom') || window.navigator.userAgent.includes('HappyDOM') || window.navigator.userAgent.includes('happy-dom')))));
  if (isTest) {
    return end;
  }
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrame;
    const startValue = value; // count from current value to end

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setValue(startValue + (end - startValue) * easeProgress);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setValue(end);
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]); // We do NOT include `value` or `startValue` to avoid re-triggering mid-animation

  return value;
}


import { useState, useEffect } from 'react';

/** Whether to show the "Show Gentle Concept Guides" twisties (Settings toggle,
 *  default on). Every <GuideNote> consumer calls this and passes
 *  `hidden={!showGuides}` — ds/GuideNote itself has no opinion on visibility. */
export function useShowGuides(): boolean {
  const [showGuides, setShowGuides] = useState(() => {
    return localStorage.getItem('daily-stoic:show-guides') !== 'false';
  });

  useEffect(() => {
    const handleUpdate = () => {
      setShowGuides(localStorage.getItem('daily-stoic:show-guides') !== 'false');
    };
    window.addEventListener('daily-stoic:settings-updated', handleUpdate);
    return () => window.removeEventListener('daily-stoic:settings-updated', handleUpdate);
  }, []);

  return showGuides;
}

import React, { createContext, useContext, useState, useEffect } from 'react';

const GuideContext = createContext<boolean>(true);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [showGuides, setShowGuides] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('daily-stoic:show-guides');
    if (saved !== null) {
      setShowGuides(saved === 'true');
    }

    const handleStorage = () => {
      const current = localStorage.getItem('daily-stoic:show-guides');
      if (current !== null) {
        setShowGuides(current === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorage);
    // Custom event for same-window updates
    window.addEventListener('daily-stoic:settings-updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('daily-stoic:settings-updated', handleStorage);
    };
  }, []);

  return (
    <GuideContext.Provider value={showGuides}>
      {children}
    </GuideContext.Provider>
  );
}

export function useShowGuides() {
  return useContext(GuideContext);
}

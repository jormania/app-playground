import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export interface AppGuideNoteProps {
  summary: React.ReactNode;
  children: React.ReactNode;
}

export default function AppGuideNote({ summary, children }: AppGuideNoteProps) {
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

  if (!showGuides) return null;

  return (
    <details className="group rounded-md border border-tertiary bg-background-secondary/60 px-3 py-2 sm:px-4 sm:py-3 [&_svg]:open:rotate-90">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-sans text-sm font-medium text-text-secondary marker:hidden hover:text-text-primary transition-colors">
        <ChevronRight size={14} className="shrink-0 transition-transform duration-fast" aria-hidden />
        {summary}
      </summary>
      <div className="mt-3 pl-[22px] font-sans text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
    </details>
  );
}

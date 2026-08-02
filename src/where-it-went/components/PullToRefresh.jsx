import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  
  const pullDistance = Math.max(0, currentY - startY);
  const maxPull = 100;
  const threshold = 60;
  
  const isPulling = pullDistance > 0 && !refreshing;
  const transformY = isPulling ? Math.min(pullDistance, maxPull) : 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        setStartY(e.touches[0].clientY);
        setCurrentY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (container.scrollTop === 0 && startY > 0) {
        setCurrentY(e.touches[0].clientY);
        // Only prevent default if we are actively pulling down
        if (e.touches[0].clientY > startY) {
          e.preventDefault(); // Prevent scroll while pulling
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > threshold && !refreshing && onRefresh) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
      setStartY(0);
      setCurrentY(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, currentY, pullDistance, refreshing, onRefresh]);

  return (
    <div ref={containerRef} className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${maxPull}px`,
          transform: `translateY(${refreshing ? 0 : transformY - maxPull}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease',
          zIndex: 10
        }}
      >
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '50%',
          padding: '8px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-ink)'
        }}>
          <Loader2 
            size={24} 
            style={{ 
              transform: `rotate(${isPulling ? pullDistance * 2 : 0}deg)`,
              animation: refreshing ? 'spin 1s linear infinite' : 'none'
            }} 
          />
        </div>
      </div>
      
      <div style={{ 
        transform: `translateY(${refreshing ? 50 : transformY * 0.5}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease',
        minHeight: '100%'
      }}>
        {children}
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

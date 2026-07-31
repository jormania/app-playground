import { useState, useRef } from "react";

export function SwipeableRow({ children, onSwipeLeft, onSwipeRight, onLongPress, enabled = true }) {
  const [translateX, setTranslateX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const timerRef = useRef(null);
  const threshold = 80;

  if (!enabled) {
    return <div className="transaction-row-wrapper">{children}</div>;
  }

  const clearLongPressTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setSwiping(true);

    if (onLongPress) {
      timerRef.current = setTimeout(() => {
        onLongPress();
        timerRef.current = null;
      }, 500);
    }
  };

  const handleTouchMove = (e) => {
    if (!swiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    if (Math.abs(diff) > 10) {
      clearLongPressTimer();
    }
    
    // Optional: Add resistance or boundaries
    if (diff > 120) setTranslateX(120 + (diff - 120) * 0.2);
    else if (diff < -120) setTranslateX(-120 + (diff + 120) * 0.2);
    else setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    if (!swiping) return;
    setSwiping(false);
    
    if (translateX > threshold) {
      if (onSwipeRight) onSwipeRight();
    } else if (translateX < -threshold) {
      if (onSwipeLeft) onSwipeLeft();
    }
    
    setTranslateX(0);
  };

  return (
    <div 
      className="transaction-row-wrapper"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => {
        // Prevent default context menu on long press if we handle it
        if (onLongPress) e.preventDefault();
      }}
    >
      <div className="swipe-action-bg">
        <div className="swipe-action-right" style={{ opacity: translateX > 20 ? 1 : 0 }}>
          Repeat 
        </div>
        <div className="swipe-action-left" style={{ opacity: translateX < -20 ? 1 : 0 }}>
           Split
        </div>
      </div>
      <div 
        className={`transaction-row ${swiping ? "swiping" : ""}`} 
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

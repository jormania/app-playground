import React, { useState, useEffect } from 'react';
import styles from './BreathingWidget.module.css';
import { Button } from './Button';
import { triggerHaptic } from '../../shared/haptics';
import { playChime } from '../../shared/audio';

export interface BreathingWidgetProps {
  onComplete?: () => void;
  cycles?: number;
}

const PHASES = ['Inhale', 'Hold', 'Exhale', 'Hold'];
const PHASE_DURATION_MS = 4000;

export function BreathingWidget({ onComplete, cycles = 3 }: BreathingWidgetProps) {
  const [isActive, setIsActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    // Play chime and haptic on the very first phase immediately
    playChime();
    triggerHaptic('transition');

    const interval = setInterval(() => {
      setPhaseIndex((prev) => {
        const next = (prev + 1) % 4;
        if (next === 0) {
          setCyclesCompleted((c) => {
            const nextCycle = c + 1;
            if (nextCycle >= cycles) {
              setIsActive(false);
              if (onComplete) {
                setTimeout(onComplete, 1000); // Give user a moment before closing
              }
            } else {
               // Next cycle begins
               playChime();
               triggerHaptic('transition');
            }
            return nextCycle;
          });
        } else {
          // Play chime/haptic on each internal phase change
          playChime();
          triggerHaptic('transition');
        }
        return next;
      });
    }, PHASE_DURATION_MS);

    return () => clearInterval(interval);
  }, [isActive, cycles, onComplete]);

  const handleStart = () => {
    setPhaseIndex(0);
    setCyclesCompleted(0);
    setIsActive(true);
  };

  return (
    <div className={styles.container}>
      {isActive ? (
        <>
          <div className={styles.breathingCircle}></div>
          <div className={styles.text}>{PHASES[phaseIndex]}</div>
        </>
      ) : (
        <>
          <div className={styles.text}>Center yourself before reflecting.</div>
          <Button className={styles.startButton} onClick={handleStart} variant="primary">
            Start Breathing
          </Button>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Timer.module.scss';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerProps {
  duration: number;
  autoStart?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onComplete?: () => void;
  onManualComplete?: () => void;
  onTick?: (remaining: number) => void;
  label?: string;
  showControls?: boolean;
  showCompleteButton?: boolean;
}

export interface TimerRef {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getRemainingTime: () => number;
}

interface TimerInternalState {
  state: TimerState;
  remainingTime: number;
  startTime: number | null;
  pausedTime: number;
}

export const Timer: React.FC<TimerProps> = ({
  duration,
  autoStart = false,
  onStart,
  onStop,
  onComplete,
  onManualComplete,
  onTick,
  label,
  showControls = true,
  showCompleteButton = false,
}) => {
  const [state, setState] = useState<TimerInternalState>({
    state: 'idle',
    remainingTime: duration,
    startTime: null,
    pausedTime: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Update refs when callbacks change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  }, [onComplete, onTick]);

  // Format time to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start timer
  const start = useCallback(() => {
    if (state.state === 'running') {
      console.warn('Timer already running');
      return;
    }

    if (duration <= 0) {
      console.error('Invalid duration:', duration);
      return;
    }

    const now = Date.now();
    setState((prev) => ({
      ...prev,
      state: 'running',
      startTime: now,
      remainingTime: duration,
    }));

    // Call onStart callback
    if (onStart) {
      onStart();
    }
  }, [state.state, duration, onStart]);

  // Pause timer
  const pause = useCallback(() => {
    if (state.state !== 'running') {
      console.warn('Timer is not running');
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      state: 'paused',
      pausedTime: prev.remainingTime,
    }));
  }, [state.state]);

  // Resume timer
  const resume = useCallback(() => {
    if (state.state !== 'paused') {
      console.warn('Timer is not paused');
      return;
    }

    const now = Date.now();
    setState((prev) => ({
      ...prev,
      state: 'running',
      startTime: now,
      remainingTime: prev.pausedTime,
    }));
  }, [state.state]);

  // Stop and reset timer
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState({
      state: 'idle',
      remainingTime: duration,
      startTime: null,
      pausedTime: 0,
    });

    // Call onStop callback
    if (onStop) {
      onStop();
    }
  }, [duration, onStop]);

  // Manual complete - user clicks complete button
  const manualComplete = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      state: 'completed',
      remainingTime: 0,
    }));

    if (onManualComplete) {
      onManualComplete();
    }
  }, [onManualComplete]);

  // Timer effect
  useEffect(() => {
    if (state.state !== 'running' || state.startTime === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startTime = state.startTime;
    const initialRemaining = state.remainingTime;

    // Use 100ms interval for better accuracy
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, initialRemaining - elapsed);

      setState((prev) => ({
        ...prev,
        remainingTime: remaining,
      }));

      // Call onTick callback
      if (onTickRef.current) {
        onTickRef.current(remaining);
      }

      // Complete when reaching 0
      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        setState((prev) => ({
          ...prev,
          state: 'completed',
          remainingTime: 0,
        }));

        // Call onComplete callback
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.state, state.startTime]);

  // Auto start
  useEffect(() => {
    if (autoStart && state.state === 'idle') {
      start();
    }
  }, [autoStart, state.state, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.timerComponent}>
      {label && <div className={styles.timerLabel}>{label}</div>}

      <div
        className={`${styles.timerDisplay} ${state.state === 'completed' ? styles.completed : ''}`}
        data-testid="timer-display"
      >
        {formatTime(state.remainingTime)}
      </div>

      {showControls && (
        <div className={styles.timerControls}>
          {state.state === 'idle' && (
            <button onClick={start} className={styles.btnTimerStart}>
              시작
            </button>
          )}

          {state.state === 'running' && (
            <>
              <button onClick={pause} className={styles.btnTimerPause}>
                일시정지
              </button>
              <button onClick={stop} className={styles.btnTimerStop}>
                중지
              </button>
              {showCompleteButton && (
                <button onClick={manualComplete} className={styles.btnTimerComplete}>
                  완료
                </button>
              )}
            </>
          )}

          {state.state === 'paused' && (
            <>
              <button onClick={resume} className={styles.btnTimerResume}>
                재개
              </button>
              <button onClick={stop} className={styles.btnTimerStop}>
                중지
              </button>
              {showCompleteButton && (
                <button onClick={manualComplete} className={styles.btnTimerComplete}>
                  완료
                </button>
              )}
            </>
          )}

          {state.state === 'completed' && (
            <button onClick={stop} className={styles.btnTimerReset}>
              재설정
            </button>
          )}
        </div>
      )}
    </div>
  );
};

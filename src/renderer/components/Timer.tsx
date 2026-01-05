import React, { useState, useEffect, useRef, useCallback } from 'react';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerProps {
  duration: number;
  autoStart?: boolean;
  onComplete?: () => void;
  onTick?: (remaining: number) => void;
  label?: string;
  showControls?: boolean;
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
  onComplete,
  onTick,
  label,
  showControls = true,
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
  }, [state.state, duration]);

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
  }, [duration]);

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
    <div className="timer-component">
      {label && <div className="timer-label">{label}</div>}

      <div
        className={`timer-display ${state.state === 'completed' ? 'completed' : ''}`}
        data-testid="timer-display"
      >
        {formatTime(state.remainingTime)}
      </div>

      {showControls && (
        <div className="timer-controls">
          {state.state === 'idle' && (
            <button onClick={start} className="btn-timer-start">
              시작
            </button>
          )}

          {state.state === 'running' && (
            <>
              <button onClick={pause} className="btn-timer-pause">
                일시정지
              </button>
              <button onClick={stop} className="btn-timer-stop">
                중지
              </button>
            </>
          )}

          {state.state === 'paused' && (
            <>
              <button onClick={resume} className="btn-timer-resume">
                재개
              </button>
              <button onClick={stop} className="btn-timer-stop">
                중지
              </button>
            </>
          )}

          {state.state === 'completed' && (
            <button onClick={stop} className="btn-timer-reset">
              재설정
            </button>
          )}
        </div>
      )}
    </div>
  );
};

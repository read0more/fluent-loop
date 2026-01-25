import { useRef, useCallback, useEffect } from 'react';

/**
 * 자동 전송 타이머 관리 훅
 * 침묵 감지 후 자동 전송
 */
export interface UseAutoSendReturn {
  startTimer: (callback: () => void) => void;
  stopTimer: () => void;
  resetTimer: () => void;
}

export const useAutoSend = (enabled: boolean, delay: number): UseAutoSendReturn => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<(() => void) | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (callback: () => void) => {
      if (!enabled) return;

      stopTimer();
      callbackRef.current = callback;

      timerRef.current = setTimeout(() => {
        if (callbackRef.current) {
          callbackRef.current();
        }
      }, delay * 1000);
    },
    [enabled, delay, stopTimer]
  );

  const resetTimer = useCallback(() => {
    stopTimer();
    if (callbackRef.current) {
      startTimer(callbackRef.current);
    }
  }, [stopTimer, startTimer]);

  // enabled가 false가 되면 자동으로 타이머 중지
  useEffect(() => {
    if (!enabled) {
      stopTimer();
    }
  }, [enabled, stopTimer]);

  return { startTimer, stopTimer, resetTimer };
};

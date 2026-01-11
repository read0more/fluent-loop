import React, { useState, useEffect, useRef } from 'react';
import styles from './ConversationTimer.module.scss';

export interface ConversationTimerProps {
  isActive: boolean;
  onTimeUpdate: (seconds: number) => void;
}

/**
 * 대화 경과 시간 표시 타이머
 */
export const ConversationTimer: React.FC<ConversationTimerProps> = ({
  isActive,
  onTimeUpdate,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      // 타이머 시작
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newTime = prev + 1;
          onTimeUpdate(newTime);
          return newTime;
        });
      }, 1000);
    } else {
      // 타이머 정지
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, onTimeUpdate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isNearLimit = elapsedSeconds >= 4 * 60; // 4분 이상
  const isOverLimit = elapsedSeconds >= 5 * 60; // 5분 이상

  return (
    <div className={`${styles.timer} ${isOverLimit ? styles.overLimit : isNearLimit ? styles.nearLimit : ''}`}>
      <span className={styles.icon}>⏱</span>
      <span className={styles.display}>{formatTime(elapsedSeconds)}</span>
      {isNearLimit && !isOverLimit && (
        <span className={styles.warning}>5분 제한에 근접했습니다</span>
      )}
      {isOverLimit && (
        <span className={styles.warning}>5분 제한을 초과했습니다!</span>
      )}
    </div>
  );
};

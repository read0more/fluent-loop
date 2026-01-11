import React, { useState } from 'react';
import { RetellingHistoryItem, stepToDuration, RetellingTimerStep } from '../../main/database/models';
import styles from './RetellingHistoryTooltip.module.scss';

export interface RetellingHistoryTooltipProps {
  topicId: number;
  duration: 1 | 2 | 3;
}

export const RetellingHistoryTooltip: React.FC<RetellingHistoryTooltipProps> = ({
  topicId,
  duration,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [history, setHistory] = useState<RetellingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hover 시 데이터 조회 (지연 로딩)
  const loadHistory = async () => {
    if (history.length > 0) return; // 이미 로드된 경우 스킵

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electron.invoke('get-retelling-history', {
        topicId,
        duration: stepToDuration(duration as RetellingTimerStep),
      });

      if (response.success && response.data) {
        setHistory(response.data);
      } else {
        setError(response.error || '기록 조회 실패');
      }
    } catch (err) {
      console.error('Failed to load retelling history:', err);
      setError('기록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    loadHistory();
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  return (
    <span
      className={styles.historyTooltipTrigger}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="history-tooltip-trigger"
    >
      <span className={styles.historyIcon}>📋</span>

      {isVisible && (
        <div className={styles.historyTooltip} data-testid="history-tooltip">
          <div className={styles.tooltipHeader}>
            {duration === 1 ? '3분' : duration === 2 ? '2분' : '1분'} 리텔링 기록
          </div>
          <div className={styles.tooltipContent}>
            {isLoading && <div className={styles.loading}>로딩 중...</div>}

            {error && <div className={styles.error}>{error}</div>}

            {!isLoading && !error && history.length === 0 && (
              <div className={styles.noData}>기록이 없습니다.</div>
            )}

            {!isLoading && !error && history.length > 0 && (
              <ul className={styles.historyList}>
                {history.map((item) => (
                  <li key={item.id} className={styles.historyItem} data-testid="history-item">
                    <span className={styles.date}>{formatDate(item.createdAt)}</span>
                    <span className={styles.duration}>({formatDuration(item.actualDuration)})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </span>
  );
};

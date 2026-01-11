import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RetellingHistoryItem, stepToDuration, RetellingTimerStep } from '../../main/database/models';

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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 12,
        left: rect.left - 10,
      });
      loadHistory();
    }
    setIsVisible(!isVisible);
  };

  // 외부 클릭 시 닫기
  React.useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isVisible]);

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

  const tooltipStyles: React.CSSProperties = {
    position: 'fixed',
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    zIndex: 9999,
    minWidth: 260,
    maxWidth: 400,
    background: '#1e1e1e',
    border: '1px solid #444',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  };

  const headerStyles: React.CSSProperties = {
    padding: '12px 16px',
    background: '#2a2a2a',
    borderBottom: '1px solid #444',
    fontWeight: 600,
    fontSize: 14,
    color: '#e0e0e0',
  };

  const contentStyles: React.CSSProperties = {
    padding: '8px 0',
    maxHeight: 250,
    overflowY: 'auto',
  };

  const itemStyles: React.CSSProperties = {
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#e0e0e0',
  };

  const arrowStyles: React.CSSProperties = {
    position: 'absolute',
    top: -8,
    left: 20,
    width: 0,
    height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    borderBottom: '8px solid #2a2a2a',
  };

  const tooltipContent = isVisible && (
    <div data-testid="history-tooltip" style={tooltipStyles}>
      <div style={arrowStyles} />
      <div style={headerStyles}>
        {duration === 1 ? '3분' : duration === 2 ? '2분' : '1분'} 리텔링 기록
      </div>
      <div style={contentStyles}>
        {isLoading && (
          <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>로딩 중...</div>
        )}

        {error && (
          <div style={{ padding: 16, textAlign: 'center', color: '#ff6b6b' }}>{error}</div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>기록이 없습니다.</div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {history.map((item) => (
              <li key={item.id} style={itemStyles} data-testid="history-item">
                <span>{formatDate(item.createdAt)}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>
                  ({formatDuration(item.actualDuration)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        style={{ marginLeft: 4, cursor: 'pointer' }}
        onClick={handleClick}
        data-testid="history-tooltip-trigger"
      >
        <span style={{ fontSize: 14, opacity: isVisible ? 1 : 0.7 }}>📋</span>
      </span>
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
};

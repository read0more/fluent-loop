import React, { useState, useEffect, useRef } from 'react';
import { Topic, CEFRLevel } from '../../main/database/models';
import styles from './TopicSelector.module.scss';

export interface TopicSelectorProps {
  currentTopicId: number | null;
  onTopicSelect: (topicId: number) => void;
  disabled?: boolean;
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  currentTopicId,
  onTopicSelect,
  disabled = false,
}) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 토픽 목록 로드 함수
  const loadTopics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electron.invoke('get-all-topics');

      if (response.success && response.data) {
        setTopics(response.data);
      } else {
        setError(response.error || '토픽 목록 로드 실패');
      }
    } catch (error) {
      console.error('Failed to load topics:', error);
      setError('토픽 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 토픽 로드
  useEffect(() => {
    loadTopics();
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentTopic = topics.find((t) => t.id === currentTopicId);

  const handleToggle = () => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (topicId: number) => {
    onTopicSelect(topicId);
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, topicId: number) => {
    e.stopPropagation(); // 부모 버튼 클릭 이벤트 방지

    try {
      const response = await window.electron.invoke('delete-topic', { topicId });

      if (response.success) {
        // 토픽 목록 새로고침
        await loadTopics();
      } else {
        setError(response.error || '토픽 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete topic:', error);
      setError('토픽 삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 토픽이 없으면 렌더링하지 않음
  if (topics.length === 0) {
    return null;
  }

  return (
    <div className={styles.topicSelector} ref={dropdownRef}>
      <label className={styles.selectorLabel}>토픽 선택</label>

      {/* 드롭다운 헤더 */}
      <button
        className={`${styles.selectorHeader} ${isOpen ? styles.open : ''}`}
        onClick={handleToggle}
        disabled={disabled || isLoading}
        aria-expanded={isOpen}
        aria-label="토픽 선택 드롭다운"
      >
        <div className={styles.currentTopic}>
          {currentTopic ? (
            <>
              <span className={styles.topicTitle}>{currentTopic.title}</span>
              <span className={styles.topicMeta}>
                <span className={styles.cefrBadge}>{currentTopic.cefrLevel}</span>
                <span className={styles.date}>{formatDate(currentTopic.createdAt)}</span>
              </span>
            </>
          ) : (
            <span className={styles.placeholder}>토픽을 선택하세요</span>
          )}
        </div>
        <span className={`${styles.chevron} ${isOpen ? styles.up : ''}`}>▼</span>
      </button>

      {/* 드롭다운 리스트 */}
      {isOpen && (
        <div className={styles.dropdownList} role="listbox">
          {isLoading && (
            <div className={styles.loadingState}>
              <span>로딩 중...</span>
            </div>
          )}

          {error && (
            <div className={styles.errorState}>
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && topics.length === 0 && (
            <div className={styles.emptyState}>생성된 토픽이 없습니다.</div>
          )}

          {!isLoading &&
            !error &&
            topics.map((topic) => (
              <button
                key={topic.id}
                className={`${styles.topicItem} ${topic.id === currentTopicId ? styles.active : ''}`}
                onClick={() => handleSelect(topic.id)}
                role="option"
                aria-selected={topic.id === currentTopicId}
              >
                <div className={styles.itemContent}>
                  <span className={styles.itemTitle}>{topic.title}</span>
                  <div className={styles.itemMeta}>
                    <span className={styles.cefrBadge}>{topic.cefrLevel}</span>
                    <span className={styles.date}>{formatDate(topic.createdAt)}</span>
                    {topic.id === currentTopicId && <span className={styles.activeBadge}>현재</span>}
                  </div>
                </div>
                {/* 삭제 버튼 - 현재 활성 토픽은 삭제 불가 */}
                {topic.id !== currentTopicId && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, topic.id)}
                    title="토픽 삭제"
                  >
                    ✕
                  </button>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

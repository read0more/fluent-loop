import React from 'react';
import {
  ConversationCorrectionResult,
  CorrectionCategory,
} from '../../../main/database/models';
import styles from './CorrectedMessageItem.module.scss';

interface CorrectedMessageItemProps {
  correction: ConversationCorrectionResult;
  index: number;
  onPlayTTS?: (text: string) => void;
}

const CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  naturalness: '자연스러움',
};

const CATEGORY_COLORS: Record<CorrectionCategory, string> = {
  grammar: 'red',
  vocabulary: 'blue',
  naturalness: 'green',
};

// 시간 포맷 (초 -> MM:SS)
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const CorrectedMessageItem: React.FC<CorrectedMessageItemProps> = ({
  correction,
  index,
  onPlayTTS,
}) => {
  const { speaker, original, corrected, explanation, categories, timestamp } =
    correction;

  const isAI = speaker === 'ai';
  const isModified = original.trim() !== corrected.trim();

  // 단어 단위 Diff 렌더링
  const renderDiff = () => {
    if (!isModified) {
      return <span className={styles.textCorrect}>{corrected}</span>;
    }

    const originalWords = original.split(/\s+/);
    const correctedWords = corrected.split(/\s+/);
    const maxLength = Math.max(originalWords.length, correctedWords.length);
    const diffElements: React.ReactElement[] = [];

    for (let i = 0; i < maxLength; i++) {
      const origWord = originalWords[i] || '';
      const corrWord = correctedWords[i] || '';

      if (origWord === corrWord) {
        diffElements.push(
          <span key={i} className={styles.wordUnchanged}>
            {corrWord}{' '}
          </span>
        );
      } else if (origWord && corrWord) {
        diffElements.push(
          <span key={i} className={styles.wordChanged}>
            {corrWord}{' '}
          </span>
        );
      } else if (corrWord) {
        diffElements.push(
          <span key={i} className={styles.wordAdded}>
            {corrWord}{' '}
          </span>
        );
      }
    }

    return <>{diffElements}</>;
  };

  return (
    <div className={`${styles.item} ${isAI ? styles.ai : styles.user}`}>
      {/* 메시지 헤더 */}
      <div className={styles.header}>
        <span className={`${styles.speakerLabel} ${isAI ? styles.ai : styles.user}`}>
          {isAI ? 'AI' : 'You'}
        </span>
        <span className={styles.time}>{formatTime(timestamp)}</span>
        {onPlayTTS && (
          <button
            className={styles.btnPlayTts}
            onClick={() => onPlayTTS(isModified ? corrected : original)}
            title="음성으로 듣기"
          >
            🔊
          </button>
        )}
      </div>

      {/* 메시지 내용 */}
      <div className={styles.content}>
        <div className={styles.originalText}>{original}</div>
      </div>

      {/* User 메시지이고 수정된 경우 첨삭 결과 표시 */}
      {!isAI && isModified && (
        <div className={styles.correctionDetail}>
          <div className={styles.correctionRow}>
            <label className={styles.correctionLabel}>수정:</label>
            <div className={styles.correctedText}>{renderDiff()}</div>
          </div>

          {explanation && (
            <div className={styles.correctionRow}>
              <label className={styles.correctionLabel}>설명:</label>
              <div className={styles.explanationText}>{explanation}</div>
            </div>
          )}

          {categories.length > 0 && (
            <div className={styles.correctionCategories}>
              {categories.map((category) => (
                <span
                  key={category}
                  className={`${styles.categoryBadge} ${styles[CATEGORY_COLORS[category]]}`}
                >
                  {CATEGORY_LABELS[category]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User 메시지이고 수정되지 않은 경우 */}
      {!isAI && !isModified && (
        <div className={`${styles.correctionDetail} ${styles.correct}`}>
          <span className={styles.correctBadge}>✓ 올바른 문장</span>
        </div>
      )}
    </div>
  );
};

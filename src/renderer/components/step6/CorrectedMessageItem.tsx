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
  // TTS 상태 props
  isPlaying?: boolean;
  isSynthesizing?: boolean;
}

const CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  naturalness: '자연스러움',
  punctuation: '구두점',
};

const CATEGORY_COLORS: Record<CorrectionCategory, string> = {
  grammar: 'red',
  vocabulary: 'blue',
  naturalness: 'green',
  punctuation: 'orange',
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
  isPlaying = false,
  isSynthesizing = false,
}) => {
  const { speaker, original, normalized, corrected, explanation, categories, timestamp } =
    correction;

  const isAI = speaker === 'ai';
  const isModified = original.trim() !== corrected.trim();
  const hasGrammarCorrection = normalized.trim() !== corrected.trim();

  // 단어 단위 Diff 렌더링 (normalized와 corrected 비교 - 문법 첨삭만 하이라이트)
  const renderDiff = () => {
    if (!hasGrammarCorrection) {
      return <span className={styles.textCorrect}>{corrected}</span>;
    }

    const normalizedWords = normalized.split(/\s+/);
    const correctedWords = corrected.split(/\s+/);
    const maxLength = Math.max(normalizedWords.length, correctedWords.length);
    const diffElements: React.ReactElement[] = [];

    for (let i = 0; i < maxLength; i++) {
      const normWord = normalizedWords[i] || '';
      const corrWord = correctedWords[i] || '';

      if (normWord === corrWord) {
        diffElements.push(
          <span key={i} className={styles.wordUnchanged}>
            {corrWord}{' '}
          </span>
        );
      } else if (normWord && corrWord) {
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
            title={
              isSynthesizing
                ? 'TTS 생성 중...'
                : isPlaying
                ? '재생 중...'
                : '음성으로 듣기'
            }
            disabled={isSynthesizing}
          >
            {isSynthesizing
              ? '🔄 TTS 생성 중...'
              : isPlaying
              ? '⏸️ 재생 중...'
              : '🔊 듣기'}
          </button>
        )}
      </div>

      {/* 메시지 내용 */}
      <div className={styles.content}>
        <div className={styles.originalText}>{normalized}</div>
      </div>

      {/* User 메시지이고 수정된 경우 첨삭 결과 표시 */}
      {!isAI && isModified && (
        <div className={styles.correctionDetail}>
          {/* 문법 첨삭이 있는 경우만 수정 표시 */}
          {hasGrammarCorrection && (
            <div className={styles.correctionRow}>
              <label className={styles.correctionLabel}>수정:</label>
              <div className={styles.correctedText}>{renderDiff()}</div>
            </div>
          )}

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

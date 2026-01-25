import React from 'react';
import { CorrectionResult, CorrectionCategory } from '../../main/database/models';
import styles from './SentenceComparison.module.scss';

interface SentenceComparisonProps {
  correction: CorrectionResult;
  index: number;
  isHighlighted?: boolean;
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

export const SentenceComparison: React.FC<SentenceComparisonProps> = ({
  correction,
  index,
  isHighlighted = false,
}) => {
  const { original, corrected, explanation, categories } = correction;

  // 문장이 수정되었는지 확인
  const isModified = original.trim() !== corrected.trim();

  // 간단한 Diff 시각화 (단어 단위 비교)
  const renderDiff = () => {
    if (!isModified) {
      return <div className={`${styles.text} ${styles.correct}`}>{corrected}</div>;
    }

    // 단어 단위로 분리
    const originalWords = original.split(/\s+/);
    const correctedWords = corrected.split(/\s+/);

    // 간단한 diff (완벽하지 않지만 MVP에는 충분)
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
        // 변경됨
        diffElements.push(
          <span key={i} className={styles.wordChanged}>
            {corrWord}{' '}
          </span>
        );
      } else if (corrWord) {
        // 추가됨
        diffElements.push(
          <span key={i} className={styles.wordAdded}>
            {corrWord}{' '}
          </span>
        );
      }
    }

    return <div className={`${styles.text} ${styles.modified}`}>{diffElements}</div>;
  };

  return (
    <div className={`${styles.comparison} ${isHighlighted ? styles.highlighted : ''}`}>
      <div className={styles.header}>
        <span className={styles.number}>문장 {index + 1}</span>
        <div className={styles.badges}>
          {categories?.map((category) => (
            <span
              key={category}
              className={`${styles.badge} ${styles[CATEGORY_COLORS[category]]}`}
            >
              {CATEGORY_LABELS[category]}
            </span>
          ))}
          {!isModified && (
            <span className={`${styles.badge} ${styles.green}`}>올바름</span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <label className={styles.sectionLabel}>원본:</label>
          <div className={`${styles.text} ${styles.original}`}>{original}</div>
        </div>

        {isModified && (
          <div className={styles.section}>
            <label className={styles.sectionLabel}>수정:</label>
            {renderDiff()}
          </div>
        )}

        <div className={`${styles.section} ${styles.explanation}`}>
          <label className={styles.sectionLabel}>설명:</label>
          <div className={styles.explanationText}>{explanation}</div>
        </div>
      </div>
    </div>
  );
};

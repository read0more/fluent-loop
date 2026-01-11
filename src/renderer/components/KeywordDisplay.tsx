import React from 'react';
import styles from './KeywordDisplay.module.scss';

export interface KeywordDisplayProps {
  keywords: string[];
  title?: string;
  maxDisplay?: number;
  orientation?: 'horizontal' | 'vertical';
}

export const KeywordDisplay: React.FC<KeywordDisplayProps> = ({
  keywords,
  title = '핵심 키워드',
  maxDisplay,
  orientation = 'vertical',
}) => {
  const displayedKeywords = maxDisplay ? keywords.slice(0, maxDisplay) : keywords;

  if (keywords.length === 0) {
    return (
      <div className={`${styles.keywordDisplay} ${styles.empty}`}>
        <h3>{title}</h3>
        <p className={styles.emptyMessage}>키워드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.keywordDisplay}>
      <h3>{title}</h3>
      <ul className={styles.keywordList}>
        {displayedKeywords.map((keyword, index) => (
          <li key={index} className={styles.keywordItem}>
            {keyword}
          </li>
        ))}
      </ul>
      {maxDisplay && keywords.length > maxDisplay && (
        <p className={styles.moreKeywords}>+{keywords.length - maxDisplay} more</p>
      )}
    </div>
  );
};

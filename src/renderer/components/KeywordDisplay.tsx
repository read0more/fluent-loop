import React from 'react';

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
      <div className="keyword-display empty">
        <h3>{title}</h3>
        <p className="empty-message">키워드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`keyword-display ${orientation}`}>
      <h3>{title}</h3>
      <ul className="keyword-list">
        {displayedKeywords.map((keyword, index) => (
          <li key={index} className="keyword-item">
            {keyword}
          </li>
        ))}
      </ul>
      {maxDisplay && keywords.length > maxDisplay && (
        <p className="more-keywords">+{keywords.length - maxDisplay} more</p>
      )}
    </div>
  );
};

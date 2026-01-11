import React from 'react';
import { CEFRLevel } from '../../main/database/models';
import styles from './CEFRSelector.module.scss';

export interface CEFRSelectorProps {
  value: CEFRLevel;
  onChange: (level: CEFRLevel) => void;
  disabled?: boolean;
  showDescriptions?: boolean;
}

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: '초급 - 간단한 일상 표현',
  A2: '초중급 - 기본 의사소통',
  B1: '중급 - 일상적인 주제',
  B2: '중상급 - 복잡한 주제',
  C1: '고급 - 전문적인 주제',
  C2: '최상급 - 네이티브 수준',
};

export const CEFRSelector: React.FC<CEFRSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showDescriptions = true,
}) => {
  return (
    <div className={styles.cefrSelector}>
      <label className={styles.selectorLabel}>CEFR 레벨 선택</label>

      <div className={styles.levelOptions}>
        {CEFR_LEVELS.map((level) => (
          <div key={level} className={styles.levelOption}>
            <input
              type="radio"
              id={`cefr-${level}`}
              name="cefr-level"
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              disabled={disabled}
            />
            <label htmlFor={`cefr-${level}`}>
              <span className={styles.levelName}>{level}</span>
              {showDescriptions && <span className={styles.levelDesc}>{CEFR_DESCRIPTIONS[level]}</span>}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

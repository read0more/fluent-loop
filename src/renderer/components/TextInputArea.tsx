import React, { useState, useEffect } from 'react';
import styles from './TextInputArea.module.scss';

interface TextInputAreaProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const TextInputArea: React.FC<TextInputAreaProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '리텔링한 내용을 입력하세요...',
  maxLength = 5000,
}) => {
  const [sentenceCount, setSentenceCount] = useState(0);

  // 문장 개수 계산
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSentenceCount(0);
      return;
    }

    // 간단한 문장 분리 로직 (마침표, 느낌표, 물음표 기준)
    const sentences = value
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setSentenceCount(sentences.length);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter로 제출
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && value.trim().length > 0) {
        onSubmit();
      }
    }
  };

  const isSubmitDisabled = disabled || value.trim().length === 0;

  return (
    <div className={styles.area}>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={10}
      />

      <div className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.charCount}>
            {value.length} / {maxLength} 자
          </span>
          <span className={styles.sentenceCount}>문장: {sentenceCount}개</span>
        </div>

        <button
          className={`${styles.submitButton} ${styles.primary}`}
          onClick={onSubmit}
          disabled={isSubmitDisabled}
        >
          첨삭 받기
        </button>
      </div>

      <div className={styles.hint}>
        팁: Ctrl+Enter를 눌러 빠르게 제출할 수 있습니다
      </div>
    </div>
  );
};

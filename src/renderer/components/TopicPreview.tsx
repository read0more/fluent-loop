import React, { useState, useEffect } from 'react';
import { CEFRLevel } from '../../main/database/models';
import styles from './TopicPreview.module.scss';

export interface TopicPreviewProps {
  title: string;
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  recordingPath: string | null;
  onConfirm: () => void;
  onRegenerate: (editedKoreanText: string) => void;
  onTitleChange: (newTitle: string) => void;
  onCancel?: () => void;
  inline?: boolean;
}

export const TopicPreview: React.FC<TopicPreviewProps> = ({
  title,
  koreanText,
  englishText,
  keywords,
  cefrLevel,
  onConfirm,
  onRegenerate,
  onTitleChange,
  onCancel,
  inline = false,
}) => {
  const [editedKoreanText, setEditedKoreanText] = useState(koreanText);
  const [isModified, setIsModified] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isTitleModified, setIsTitleModified] = useState(false);

  // koreanText가 변경되면 (재생성 후) 상태 초기화
  useEffect(() => {
    setEditedKoreanText(koreanText);
    setIsModified(false);
  }, [koreanText]);

  // title이 변경되면 상태 초기화
  useEffect(() => {
    setEditedTitle(title);
    setIsTitleModified(false);
  }, [title]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditedTitle(newTitle);
    setIsTitleModified(newTitle !== title);
  };

  const handleTitleEditComplete = () => {
    setIsTitleEditing(false);
    if (isTitleModified) {
      onTitleChange(editedTitle);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleEditComplete();
    }
    if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsTitleModified(false);
      setIsTitleEditing(false);
    }
  };

  const handleKoreanTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedKoreanText(newText);
    setIsModified(newText !== koreanText);
  };

  const handleRegenerate = () => {
    onRegenerate(editedKoreanText);
  };

  return (
    <div className={`${styles.preview}${inline ? ` ${styles.inline}` : ''}`}>
      {!inline && <h2>토픽 미리보기</h2>}

      <div className={`${styles.section} ${styles.titleSection}`}>
        <h3>
          토픽 제목 {isTitleModified && <span className={styles.modifiedBadge}>(수정됨)</span>}
        </h3>
        {isTitleEditing ? (
          <div className={styles.titleEditContainer}>
            <input
              type="text"
              className={styles.titleInput}
              value={editedTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleEditComplete}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              maxLength={100}
            />
          </div>
        ) : (
          <div className={styles.titleDisplay} onClick={() => setIsTitleEditing(true)}>
            <span className={styles.titleText}>{editedTitle || '(제목 없음)'}</span>
            <button
              className={styles.btnEditTitle}
              onClick={(e) => {
                e.stopPropagation();
                setIsTitleEditing(true);
              }}
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3>한국어 원문 {isModified && <span className={styles.modifiedBadge}>(수정됨)</span>}</h3>
        <textarea
          className={`${styles.content} ${styles.koreanText} ${styles.editable}`}
          value={editedKoreanText}
          onChange={handleKoreanTextChange}
          rows={5}
          placeholder="한국어 텍스트를 입력하세요..."
        />
        {isModified && (
          <button onClick={handleRegenerate} className={styles.btnRegenerateInline}>
            수정된 텍스트로 영어 재생성
          </button>
        )}
      </div>

      <div className={styles.section}>
        <h3>영어 스크립트</h3>
        <div className={`${styles.content} ${styles.englishText}`}>{englishText}</div>
      </div>

      <div className={styles.section}>
        <h3>학습 키워드</h3>
        <div className={styles.keywords}>
          {keywords.map((keyword, index) => (
            <span key={index} className={styles.keywordBadge}>
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3>CEFR 레벨</h3>
        <div className={styles.cefrLevelBadge}>{cefrLevel}</div>
      </div>

      <div className={styles.actions}>
        <button onClick={onConfirm} className={styles.btnConfirm}>
          저장하고 시작
        </button>
        <button onClick={handleRegenerate} className={styles.btnRegenerate}>
          다시 생성
        </button>
        {onCancel && (
          <button onClick={onCancel} className={styles.btnCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
};

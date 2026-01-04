import React, { useState, useEffect } from 'react';
import { CEFRLevel } from '../../main/database/models';

export interface TopicPreviewProps {
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  recordingPath: string | null;
  onConfirm: () => void;
  onRegenerate: (editedKoreanText: string) => void;
  onCancel?: () => void;
}

export const TopicPreview: React.FC<TopicPreviewProps> = ({
  koreanText,
  englishText,
  keywords,
  cefrLevel,
  onConfirm,
  onRegenerate,
  onCancel,
}) => {
  const [editedKoreanText, setEditedKoreanText] = useState(koreanText);
  const [isModified, setIsModified] = useState(false);

  // koreanText가 변경되면 (재생성 후) 상태 초기화
  useEffect(() => {
    setEditedKoreanText(koreanText);
    setIsModified(false);
  }, [koreanText]);

  const handleKoreanTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedKoreanText(newText);
    setIsModified(newText !== koreanText);
  };

  const handleRegenerate = () => {
    onRegenerate(editedKoreanText);
  };

  return (
    <div className="topic-preview">
      <h2>토픽 미리보기</h2>

      <div className="preview-section">
        <h3>한국어 원문 {isModified && <span className="modified-badge">(수정됨)</span>}</h3>
        <textarea
          className="preview-content korean-text editable"
          value={editedKoreanText}
          onChange={handleKoreanTextChange}
          rows={5}
          placeholder="한국어 텍스트를 입력하세요..."
        />
        {isModified && (
          <button onClick={handleRegenerate} className="btn-regenerate-inline">
            수정된 텍스트로 영어 재생성
          </button>
        )}
      </div>

      <div className="preview-section">
        <h3>영어 스크립트</h3>
        <div className="preview-content english-text">{englishText}</div>
      </div>

      <div className="preview-section">
        <h3>학습 키워드</h3>
        <div className="keywords">
          {keywords.map((keyword, index) => (
            <span key={index} className="keyword-badge">
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="preview-section">
        <h3>CEFR 레벨</h3>
        <div className="cefr-level-badge">{cefrLevel}</div>
      </div>

      <div className="preview-actions">
        <button onClick={onConfirm} className="btn-confirm">
          저장하고 시작
        </button>
        <button onClick={handleRegenerate} className="btn-regenerate">
          다시 생성
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-cancel">
            취소
          </button>
        )}
      </div>
    </div>
  );
};

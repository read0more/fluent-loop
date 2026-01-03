import React from 'react';
import { CEFRLevel } from '../../main/database/models';

export interface TopicPreviewProps {
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  recordingPath: string | null;
  onConfirm: () => void;
  onRegenerate: () => void;
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
  return (
    <div className="topic-preview">
      <h2>토픽 미리보기</h2>

      <div className="preview-section">
        <h3>한국어 원문</h3>
        <div className="preview-content korean-text">{koreanText}</div>
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
        <button onClick={onRegenerate} className="btn-regenerate">
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

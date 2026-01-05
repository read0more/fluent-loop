import React from 'react';
import { CorrectionResult } from '../../main/database/models';
import { SentenceComparison } from './SentenceComparison';
import { LoadingSpinner } from './LoadingSpinner';

interface CorrectionDisplayProps {
  corrections: CorrectionResult[];
  onPlayTTS: (text: string, index: number) => void;
  isLoading?: boolean;
  currentProcessingIndex?: number;
}

export const CorrectionDisplay: React.FC<CorrectionDisplayProps> = ({
  corrections,
  onPlayTTS,
  isLoading = false,
  currentProcessingIndex = -1,
}) => {
  if (corrections.length === 0 && !isLoading) {
    return (
      <div className="correction-display empty">
        <p className="empty-message">
          위의 입력란에 리텔링한 내용을 입력하고 "첨삭 받기" 버튼을 눌러주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="correction-display">
      {isLoading && currentProcessingIndex >= 0 && (
        <div className="processing-indicator">
          <LoadingSpinner />
          <span className="processing-text">
            문장 {currentProcessingIndex + 1} / {corrections.length + 1} 처리 중...
          </span>
        </div>
      )}

      <div className="corrections-list">
        {corrections.map((correction, index) => (
          <div key={index} className="correction-item">
            <SentenceComparison
              correction={correction}
              index={index}
              isHighlighted={index === currentProcessingIndex}
            />

            <div className="correction-actions">
              <button
                className="tts-button"
                onClick={() => onPlayTTS(correction.corrected, index)}
                title="수정된 문장 듣기"
                aria-label="TTS 재생"
              >
                🔊 듣기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

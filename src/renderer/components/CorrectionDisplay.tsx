import React from 'react';
import { CorrectionResult } from '../../main/database/models';
import { SentenceComparison } from './SentenceComparison';
import { LoadingSpinner } from './LoadingSpinner';

interface SectionInfo {
  name: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionDisplayProps {
  corrections: CorrectionResult[];
  sections?: SectionInfo[];
  onPlayTTS: (text: string, index: number) => void;
  isLoading?: boolean;
  currentProcessingIndex?: number;
}

export const CorrectionDisplay: React.FC<CorrectionDisplayProps> = ({
  corrections,
  sections = [],
  onPlayTTS,
  isLoading = false,
  currentProcessingIndex = -1,
}) => {
  // 섹션별 첨삭 완료 문장 생성
  const getSectionSummaries = (): { name: string; text: string }[] => {
    if (sections.length === 0 || corrections.length === 0) {
      return [];
    }

    return sections
      .map((section) => {
        // 해당 섹션의 모든 첨삭 결과가 완료되었는지 확인
        if (section.endIndex >= corrections.length) {
          return null; // 아직 모든 문장이 첨삭되지 않음
        }

        const sectionCorrections = corrections.slice(section.startIndex, section.endIndex + 1);
        const correctedText = sectionCorrections.map((c) => c.corrected).join(' ');

        return {
          name: section.name,
          text: correctedText,
        };
      })
      .filter((s): s is { name: string; text: string } => s !== null);
  };

  if (corrections.length === 0 && !isLoading) {
    return (
      <div className="correction-display empty">
        <p className="empty-message">
          위의 입력란에 리텔링한 내용을 입력하고 "첨삭 받기" 버튼을 눌러주세요.
        </p>
      </div>
    );
  }

  const sectionSummaries = getSectionSummaries();

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

      {/* 섹션별 첨삭 완료 전체 문장 */}
      {!isLoading && sectionSummaries.length > 0 && (
        <div className="section-summaries">
          <h3 className="section-summaries-title">섹션별 첨삭 완료 문장</h3>
          {sectionSummaries.map((summary, index) => (
            <div key={index} className="section-summary-item">
              <div className="section-summary-header">
                <span className="section-name">{summary.name}</span>
                <button
                  className="tts-button"
                  onClick={() => onPlayTTS(summary.text, -1)}
                  title="전체 문장 듣기"
                  aria-label="TTS 재생"
                >
                  🔊 전체 듣기
                </button>
              </div>
              <p className="section-summary-text">{summary.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

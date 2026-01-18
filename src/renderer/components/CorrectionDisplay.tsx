import React, { useState } from 'react';
import { CorrectionResult } from '../../main/database/models';
import { SentenceComparison } from './SentenceComparison';
import { LoadingSpinner } from './LoadingSpinner';
import styles from './CorrectionDisplay.module.scss';

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
  /**
   * FR-002: TTS 중복 재생 방지
   * TC-009: CorrectionDisplay - playingId 상태 관리
   * TC-010: CorrectionDisplay - 중복 재생 방지
   */
  const [playingId, setPlayingId] = useState<number | null>(null);

  /**
   * 수정이 필요한 문장인지 확인
   */
  const needsCorrection = (correction: CorrectionResult) => {
    return correction.original.trim() !== correction.corrected.trim();
  };

  /**
   * 섹션별로 corrections 그룹화 (수정 필요한 것만 포함)
   */
  const getCorrectionsBySection = (): Array<{
    name: string | null;
    corrections: Array<{ correction: CorrectionResult; originalIndex: number }>;
  }> => {
    if (sections.length === 0) {
      // 섹션이 없으면 수정 필요한 것만 필터링하여 반환
      return [{
        name: null,
        corrections: corrections
          .map((c, idx) => ({ correction: c, originalIndex: idx }))
          .filter(item => needsCorrection(item.correction))
      }];
    }

    return sections.map(section => ({
      name: section.name,
      corrections: corrections
        .slice(section.startIndex, section.endIndex + 1)
        .map((c, idx) => ({
          correction: c,
          originalIndex: section.startIndex + idx
        }))
        .filter(item => needsCorrection(item.correction))
    }));
  };

  /**
   * FR-002: TTS 재생 핸들러 (여러 번 누르면 처음부터 다시 재생)
   * TC-016: TTS 재생 전체 플로우
   * TC-020: TTS 에러 발생 시 상태 복원
   */
  const handlePlayTTS = async (text: string, index: number) => {
    // 부모 컴포넌트의 onPlayTTS가 기존 오디오 중지 처리
    // return 제거 - 중복 클릭 시 처음부터 다시 재생

    try {
      setPlayingId(index);
      await onPlayTTS(text, index);
    } catch (error) {
      console.error('TTS playback failed:', error);
      // 에러 발생 시에도 상태는 복원해야 함
    } finally {
      // TC-020: 에러 발생 시에도 반드시 재생 상태 해제
      setPlayingId(null);
    }
  };

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
      <div className={`${styles.display} ${styles.empty}`}>
        <p className={styles.emptyMessage}>
          위의 입력란에 리텔링한 내용을 입력하고 "첨삭 받기" 버튼을 눌러주세요.
        </p>
      </div>
    );
  }

  const sectionSummaries = getSectionSummaries();
  const correctionsBySection = getCorrectionsBySection();
  const hasCorrectionsToShow = correctionsBySection.some(g => g.corrections.length > 0);

  return (
    <div className={styles.display}>
      {isLoading && currentProcessingIndex >= 0 && (
        <div className={styles.processingIndicator}>
          <LoadingSpinner />
          <span className={styles.processingText}>
            문장 {currentProcessingIndex + 1} / {corrections.length + 1} 처리 중...
          </span>
        </div>
      )}

      {/* 모든 문장이 올바를 경우 */}
      {!isLoading && corrections.length > 0 && !hasCorrectionsToShow && (
        <div className={styles.allCorrectMessage}>
          <span className={styles.successIcon}>&#10003;</span>
          <p>모든 문장이 올바릅니다! 수정이 필요한 부분이 없습니다.</p>
        </div>
      )}

      {/* 섹션별 첨삭 결과 (수정 필요한 문장만 표시) */}
      <div className={styles.sectionCorrectionsWrapper}>
        {correctionsBySection.map((sectionGroup, sectionIdx) => {
          // 수정 필요한 문장이 없으면 섹션 자체를 숨김
          if (sectionGroup.corrections.length === 0) return null;

          return (
            <div key={sectionIdx} className={styles.sectionCorrectionsGroup}>
              {sectionGroup.name && (
                <h3 className={styles.sectionCorrectionsHeader}>
                  {sectionGroup.name} 문장
                </h3>
              )}
              <div className={styles.list}>
                {sectionGroup.corrections.map(({ correction, originalIndex }, indexInSection) => (
                  <div key={originalIndex} className={styles.item} data-testid="correction-result">
                    <SentenceComparison
                      correction={correction}
                      index={indexInSection}
                      isHighlighted={originalIndex === currentProcessingIndex}
                    />

                    <div className={styles.actions}>
                      <button
                        className={styles.ttsButton}
                        onClick={() => handlePlayTTS(correction.corrected, originalIndex)}
                        title="수정된 문장 듣기"
                        aria-label="TTS 재생"
                        data-testid={`play-tts-${originalIndex}`}
                      >
                        {playingId === originalIndex ? '⏸️ 재생 중...' : '🔊 듣기'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 섹션별 첨삭 완료 전체 문장 */}
      {!isLoading && sectionSummaries.length > 0 && (
        <div className={styles.sectionSummaries}>
          <h3 className={styles.sectionSummariesTitle}>섹션별 첨삭 완료 문장</h3>
          {sectionSummaries.map((summary, index) => (
            <div key={index} className={styles.sectionSummaryItem}>
              <div className={styles.sectionSummaryHeader}>
                <span className={styles.sectionName}>{summary.name}</span>
                <button
                  className={styles.ttsButton}
                  onClick={() => handlePlayTTS(summary.text, -1 - index)}
                  title="전체 문장 듣기"
                  aria-label="TTS 재생"
                  data-testid={`tts-button-section-${index}`}
                >
                  {playingId === -1 - index ? '⏸️ 재생 중...' : '🔊 전체 듣기'}
                </button>
              </div>
              <p className={styles.sectionSummaryText}>{summary.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

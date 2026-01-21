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
   * TTS 생성 중 상태 관리
   * synthesizingId: TTS 생성 중인 문장의 ID
   * isSynthesizing: TTS 생성 중 여부
   */
  const [synthesizingId, setSynthesizingId] = useState<number | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

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
   * 버튼 텍스트 헬퍼 함수
   * TTS 생성 중, 재생 중, 대기 중 상태를 구분하여 표시
   */
  const getButtonText = (index: number): string => {
    if (isSynthesizing && synthesizingId === index) {
      return '🔄 TTS 생성 중...';
    }
    if (playingId === index) {
      return '⏸️ 재생 중...';
    }
    return '🔊 듣기';
  };

  /**
   * FR-002: TTS 재생 핸들러
   * TC-016: TTS 재생 전체 플로우
   * TC-020: TTS 에러 발생 시 상태 복원
   *
   * TTS 생성 단계와 재생 단계를 명확히 구분하여 표시
   * - TTS 생성 중: "🔄 TTS 생성 중..." (IPC 호출 완료까지)
   * - 재생 중: "⏸️ 재생 중..." (Audio onended 이벤트까지)
   */
  const handlePlayTTS = async (text: string, index: number) => {
    // 이미 재생 중이거나 생성 중이면 무시
    if (playingId !== null || synthesizingId !== null) return;

    try {
      // 1. TTS 생성 시작 표시
      setIsSynthesizing(true);
      setSynthesizingId(index);

      // 2. 실제 TTS 생성 (IPC 호출) - 캐시 히트 시 빠르게 완료됨
      const response = await window.electron.invoke('synthesize-tts', text);

      // 3. TTS 생성 완료 → 재생 상태로 전환
      setIsSynthesizing(false);
      setSynthesizingId(null);

      if (response.success && response.data?.filePath) {
        // 4. 재생 상태 시작
        setPlayingId(index);

        // 5. 오디오 재생 - onended에서 상태 해제
        const audio = new Audio(`file://${response.data.filePath}`);

        audio.onended = () => {
          setPlayingId(null);
        };
        audio.onerror = () => {
          console.error('오디오 재생 오류');
          setPlayingId(null);
        };

        await audio.play();
      } else {
        throw new Error(response.error || 'TTS 생성 실패');
      }
    } catch (error) {
      console.error('TTS 재생 오류:', error);
      // 에러 발생 시 모든 상태 복원
      setIsSynthesizing(false);
      setSynthesizingId(null);
      setPlayingId(null);
    }
    // NOTE: finally에서 setPlayingId(null) 하지 않음 - onended에서 처리
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
                        {getButtonText(originalIndex)}
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
                  {isSynthesizing && synthesizingId === -1 - index
                    ? '🔄 TTS 생성 중...'
                    : playingId === -1 - index
                    ? '⏸️ 재생 중...'
                    : '🔊 전체 듣기'}
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

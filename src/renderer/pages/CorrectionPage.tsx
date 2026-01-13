import React, { useState, useEffect, useCallback } from 'react';
import { TextInputArea } from '../components/TextInputArea';
import { CorrectionDisplay } from '../components/CorrectionDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CorrectionResult, Topic, CEFRLevel, RetellingTextsResult } from '../../main/database/models';
import styles from './CorrectionPage.module.scss';

interface SectionInfo {
  name: string;
  startIndex: number;
  endIndex: number;
}

interface CorrectionPageState {
  inputText: string;
  corrections: CorrectionResult[];
  sections: SectionInfo[];
  currentSentenceIndex: number;
  isLoading: boolean;
  isLoadingRetellings: boolean;
  error: string | null;
  activeTopic: Topic | null;
  isSaving: boolean;
  retellingTexts: RetellingTextsResult | null;
}

export const CorrectionPage: React.FC = () => {
  const [state, setState] = useState<CorrectionPageState>({
    inputText: '',
    corrections: [],
    sections: [],
    currentSentenceIndex: -1,
    isLoading: false,
    isLoadingRetellings: false,
    error: null,
    activeTopic: null,
    isSaving: false,
    retellingTexts: null,
  });

  // 활성 토픽 로드
  useEffect(() => {
    loadActiveTopic();
  }, []);

  const loadActiveTopic = async () => {
    try {
      const response = await window.electron.invoke('get-active-topic', {});
      if (response.success && response.data) {
        const topic = response.data;
        setState((prev) => ({ ...prev, activeTopic: topic }));

        // 리텔링 텍스트 먼저 로드 (await로 완료 대기)
        const inputText = await loadRetellingTexts(topic.id);

        // FR-001: 최근 첨삭 결과 복원 (inputText 전달하여 섹션 재추출)
        loadLatestCorrections(topic.id, inputText);
      } else {
        setState((prev) => ({
          ...prev,
          error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: '토픽 정보를 불러오는데 실패했습니다.',
      }));
    }
  };

  /**
   * FR-001: 최근 첨삭 결과 복원
   * TC-007: CorrectionPage - useEffect 최근 결과 복원
   * TC-014: 페이지 재진입 시나리오 (상태 복원)
   */
  const loadLatestCorrections = async (topicId: number, inputText: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const response = await window.electron.invoke('correction:get-latest', {
        sessionId: null, // 세션 없이 topicId로만 조회
        topicId,
      });

      if (response.success && response.data && response.data.length > 0) {
        // inputText로 섹션 정보 재추출
        const { sections } = splitSentencesWithSections(inputText);

        setState((prev) => ({
          ...prev,
          corrections: response.data,
          sections, // 섹션 정보도 복원
          isLoading: false,
        }));
        console.log(`Loaded ${response.data.length} previous correction results with ${sections.length} sections`);
      } else {
        // 첨삭 결과가 없는 경우 조용히 넘어감 (에러 표시 안 함)
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      // 최근 결과 조회 실패 시 무시 (사용자에게 에러 표시 안 함)
      console.error('Failed to load latest corrections:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // 리텔링 텍스트 로드 (inputText 반환)
  const loadRetellingTexts = async (topicId: number): Promise<string> => {
    setState((prev) => ({ ...prev, isLoadingRetellings: true }));

    try {
      const response = await window.electron.invoke('get-retelling-texts', { topicId });
      if (response.success && response.data) {
        const retellingData = response.data as RetellingTextsResult;
        const inputText = retellingData.formattedText || '';
        setState((prev) => ({
          ...prev,
          isLoadingRetellings: false,
          retellingTexts: retellingData,
          // 리텔링 텍스트가 있으면 자동으로 입력 필드에 설정
          inputText: inputText || prev.inputText,
        }));
        return inputText;
      } else {
        setState((prev) => ({
          ...prev,
          isLoadingRetellings: false,
        }));
        return '';
      }
    } catch (error) {
      console.error('리텔링 텍스트 로드 실패:', error);
      setState((prev) => ({
        ...prev,
        isLoadingRetellings: false,
      }));
      return '';
    }
  };

  // 텍스트 변경 처리
  const handleTextChange = (text: string) => {
    setState((prev) => ({ ...prev, inputText: text, error: null }));
  };

  // 구분자 패턴 (----로 시작하고 ----로 끝나는 줄)
  const SECTION_MARKER_PATTERN = /^-{2,}.*-{2,}$/;

  // 문장 분리 (구분자 처리 포함) - 섹션 정보도 함께 반환
  const splitSentencesWithSections = (
    text: string
  ): { sentences: string[]; sections: SectionInfo[] } => {
    if (!text || text.trim().length === 0) {
      return { sentences: [], sections: [] };
    }

    const sentences: string[] = [];
    const sections: SectionInfo[] = [];
    const lines = text.split('\n');

    let currentSection = '';
    let currentSectionName = '';
    let sectionStartIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 구분자인 경우
      if (SECTION_MARKER_PATTERN.test(trimmedLine)) {
        // 이전 섹션의 문장들이 있으면 처리
        if (currentSection.trim()) {
          const sectionSentences = splitTextIntoSentences(currentSection);
          if (sectionSentences.length > 0 && currentSectionName) {
            sections.push({
              name: currentSectionName,
              startIndex: sectionStartIndex,
              endIndex: sectionStartIndex + sectionSentences.length - 1,
            });
          }
          sentences.push(...sectionSentences);
          sectionStartIndex = sentences.length;
          currentSection = '';
        }
        // 새 섹션 시작
        currentSectionName = trimmedLine.replace(/-/g, '').trim();
      } else {
        // 일반 텍스트는 모아둠
        currentSection += ' ' + trimmedLine;
      }
    }

    // 마지막 섹션 처리
    if (currentSection.trim()) {
      const sectionSentences = splitTextIntoSentences(currentSection);
      if (sectionSentences.length > 0 && currentSectionName) {
        sections.push({
          name: currentSectionName,
          startIndex: sectionStartIndex,
          endIndex: sectionStartIndex + sectionSentences.length - 1,
        });
      }
      sentences.push(...sectionSentences);
    }

    return { sentences: sentences.filter((s) => s.length > 0), sections };
  };

  // 텍스트를 문장으로 분리하는 헬퍼 함수
  const splitTextIntoSentences = (text: string): string[] => {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 마침표, 느낌표, 물음표 기준 분리
    const sentences = text
      .split(/([.!?]+)/)
      .reduce((acc: string[], curr, index, arr) => {
        if (index % 2 === 0 && curr.trim()) {
          const punctuation = arr[index + 1] || '';
          acc.push((curr + punctuation).trim());
        }
        return acc;
      }, [])
      .filter((s) => s.length > 1);

    return sentences;
  };

  /**
   * FR-001: 첨삭 요청 처리 (기존 결과 초기화)
   * TC-008: CorrectionPage - 첨삭 요청 시 기존 결과 초기화
   */
  const handleCorrectRequest = async () => {
    if (!state.activeTopic) {
      setState((prev) => ({
        ...prev,
        error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
      }));
      return;
    }

    const { sentences, sections } = splitSentencesWithSections(state.inputText);

    if (sentences.length === 0) {
      setState((prev) => ({
        ...prev,
        error: '입력된 문장이 없습니다.',
      }));
      return;
    }

    // TTS 캐시 삭제 (새로운 첨삭 세션 시작)
    await window.electron.invoke('clear-tts-cache').catch((err) => {
      console.warn('Failed to clear TTS cache:', err);
    });

    // TC-008: 기존 첨삭 결과 초기화
    setState((prev) => ({
      ...prev,
      isLoading: true,
      corrections: [],
      sections,
      currentSentenceIndex: 0,
      error: null,
    }));

    await processSentences(sentences, state.activeTopic.cefrLevel);
  };

  // 배치 첨삭 (한 번의 API 호출로 모든 문장 처리)
  const processSentences = async (sentences: string[], cefrLevel: CEFRLevel) => {
    try {
      const response = await window.electron.invoke('correct-sentences-batch', {
        sentences,
        cefrLevel,
      });

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          corrections: response.data,
          isLoading: false,
          currentSentenceIndex: -1,
        }));

        // 첨삭 완료 후 자동 저장 (상태 유지를 위해)
        if (state.activeTopic) {
          try {
            await window.electron.invoke('save-correction', {
              corrections: response.data,
              sessionId: null, // 세션 없이 topicId로만 저장
              topicId: state.activeTopic.id,
            });
            console.log('Corrections auto-saved successfully');
          } catch (saveError) {
            console.error('Auto-save failed:', saveError);
            // 저장 실패해도 첨삭 결과는 표시 (사용자에게 에러 표시 안 함)
          }
        }
      } else {
        throw new Error(response.error || '첨삭 실패');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentSentenceIndex: -1,
        error: `첨삭 중 오류: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`,
      }));
    }
  };

  // TTS 재생
  const handleTTSPlay = useCallback(async (text: string, index: number) => {
    try {
      const response = await window.electron.invoke('synthesize-tts', text);

      if (response.success && response.data?.filePath) {
        const audio = new Audio(`file://${response.data.filePath}`);
        audio.play();
      } else {
        console.error('TTS 실패:', response.error);
      }
    } catch (error) {
      console.error('TTS 재생 오류:', error);
    }
  }, []);

  // 첨삭 결과 저장
  const handleSaveCorrections = async () => {
    if (!state.activeTopic || state.corrections.length === 0) {
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const response = await window.electron.invoke('save-correction', {
        corrections: state.corrections,
        sessionId: null, // 세션 없이 topicId로만 저장
        topicId: state.activeTopic.id,
      });

      if (response.success) {
        alert('첨삭 결과가 저장되었습니다!');
      } else {
        throw new Error(response.error || '저장 실패');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `저장 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      }));
    } finally {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        {state.activeTopic && (
          <p className={styles.topicInfo}>
            현재 토픽: <strong>{state.activeTopic.title}</strong> (
            {state.activeTopic.cefrLevel})
          </p>
        )}
      </header>

      {state.error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          {state.error}
        </div>
      )}

      <div className={styles.content}>
        <section className={styles.inputSection}>
          <div className={styles.inputHeader}>
            <h2>리텔링 입력</h2>
            {state.retellingTexts && state.retellingTexts.formattedText && (
              <span className={styles.retellingLoadedBadge}>
                Step 3 리텔링 텍스트 로드됨
              </span>
            )}
          </div>
          {state.isLoadingRetellings ? (
            <LoadingSpinner message="리텔링 텍스트 불러오는 중..." fullScreen={false} />
          ) : (
            <TextInputArea
              value={state.inputText}
              onChange={handleTextChange}
              onSubmit={handleCorrectRequest}
              disabled={state.isLoading}
              placeholder="3단계에서 녹음한 리텔링이 자동으로 로드됩니다. 또는 직접 입력해주세요."
            />
          )}
        </section>

        <section className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <h2>첨삭 결과</h2>
            {state.corrections.length > 0 && !state.isLoading && (
              <button
                className={styles.saveButton}
                onClick={handleSaveCorrections}
                disabled={state.isSaving}
              >
                {state.isSaving ? '저장 중...' : '결과 저장'}
              </button>
            )}
          </div>

          <CorrectionDisplay
            corrections={state.corrections}
            sections={state.sections}
            onPlayTTS={handleTTSPlay}
            isLoading={state.isLoading}
            currentProcessingIndex={state.currentSentenceIndex}
          />
        </section>
      </div>
    </div>
  );
};

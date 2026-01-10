import React, { useState, useEffect, useCallback } from 'react';
import { TextInputArea } from '../components/TextInputArea';
import { CorrectionDisplay } from '../components/CorrectionDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CorrectionResult, Topic, CEFRLevel, RetellingTextsResult } from '../../main/database/models';

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

        // 리텔링 텍스트 로드
        loadRetellingTexts(topic.id);
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

  // 리텔링 텍스트 로드
  const loadRetellingTexts = async (topicId: number) => {
    setState((prev) => ({ ...prev, isLoadingRetellings: true }));

    try {
      const response = await window.electron.invoke('get-retelling-texts', { topicId });
      if (response.success && response.data) {
        const retellingData = response.data as RetellingTextsResult;
        setState((prev) => ({
          ...prev,
          isLoadingRetellings: false,
          retellingTexts: retellingData,
          // 리텔링 텍스트가 있으면 자동으로 입력 필드에 설정
          inputText: retellingData.formattedText || prev.inputText,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoadingRetellings: false,
        }));
      }
    } catch (error) {
      console.error('리텔링 텍스트 로드 실패:', error);
      setState((prev) => ({
        ...prev,
        isLoadingRetellings: false,
      }));
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

  // 첨삭 요청 처리
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

  // 문장별 순차 첨삭
  const processSentences = async (sentences: string[], cefrLevel: CEFRLevel) => {
    const results: CorrectionResult[] = [];

    for (let i = 0; i < sentences.length; i++) {
      setState((prev) => ({ ...prev, currentSentenceIndex: i }));

      try {
        const response = await window.electron.invoke('correct-sentence', {
          sentence: sentences[i],
          cefrLevel,
        });

        if (response.success && response.data) {
          results.push(response.data);
          setState((prev) => ({
            ...prev,
            corrections: [...results],
          }));
        } else {
          throw new Error(response.error || '첨삭 실패');
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentSentenceIndex: -1,
          error: `문장 ${i + 1} 첨삭 중 오류: ${
            error instanceof Error ? error.message : '알 수 없는 오류'
          }`,
        }));
        return;
      }
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      currentSentenceIndex: -1,
    }));
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
      // 임시로 sessionId 1 사용 (실제로는 현재 세션 가져와야 함)
      const sessionId = 1;

      const response = await window.electron.invoke('save-correction', {
        corrections: state.corrections,
        sessionId,
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
    <div className="correction-page">
      <header className="page-header">
        {state.activeTopic && (
          <p className="topic-info">
            현재 토픽: <strong>{state.activeTopic.title}</strong> (
            {state.activeTopic.cefrLevel})
          </p>
        )}
      </header>

      {state.error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {state.error}
        </div>
      )}

      <div className="correction-content">
        <section className="input-section">
          <div className="input-header">
            <h2>리텔링 입력</h2>
            {state.retellingTexts && state.retellingTexts.formattedText && (
              <span className="retelling-loaded-badge">
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

        <section className="results-section">
          <div className="results-header">
            <h2>첨삭 결과</h2>
            {state.corrections.length > 0 && !state.isLoading && (
              <button
                className="save-button"
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

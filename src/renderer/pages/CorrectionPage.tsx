import React, { useState, useEffect, useCallback } from 'react';
import { TextInputArea } from '../components/TextInputArea';
import { CorrectionDisplay } from '../components/CorrectionDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CorrectionResult, Topic, CEFRLevel } from '../../main/database/models';

interface CorrectionPageState {
  inputText: string;
  corrections: CorrectionResult[];
  currentSentenceIndex: number;
  isLoading: boolean;
  error: string | null;
  activeTopic: Topic | null;
  isSaving: boolean;
}

export const CorrectionPage: React.FC = () => {
  const [state, setState] = useState<CorrectionPageState>({
    inputText: '',
    corrections: [],
    currentSentenceIndex: -1,
    isLoading: false,
    error: null,
    activeTopic: null,
    isSaving: false,
  });

  // 활성 토픽 로드
  useEffect(() => {
    loadActiveTopic();
  }, []);

  const loadActiveTopic = async () => {
    try {
      const response = await window.electron.invoke('get-active-topic', {});
      if (response.success && response.data) {
        setState((prev) => ({ ...prev, activeTopic: response.data! }));
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

  // 텍스트 변경 처리
  const handleTextChange = (text: string) => {
    setState((prev) => ({ ...prev, inputText: text, error: null }));
  };

  // 문장 분리 (간단한 로직)
  const splitSentences = (text: string): string[] => {
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

    const sentences = splitSentences(state.inputText);

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
      const response = await window.electron.invoke('synthesize-speech', {
        text,
      });

      if (response.success && response.data?.filePath) {
        // TTSPlayer 컴포넌트가 있다면 사용, 없으면 기본 오디오 재생
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
        <h1>Step 4: 리텔링 첨삭</h1>
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
          <h2>리텔링 입력</h2>
          <TextInputArea
            value={state.inputText}
            onChange={handleTextChange}
            onSubmit={handleCorrectRequest}
            disabled={state.isLoading}
          />
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
            onPlayTTS={handleTTSPlay}
            isLoading={state.isLoading}
            currentProcessingIndex={state.currentSentenceIndex}
          />
        </section>
      </div>
    </div>
  );
};

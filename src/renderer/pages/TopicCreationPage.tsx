import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CEFRSelector } from '../components/CEFRSelector';
import { TopicPreview } from '../components/TopicPreview';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CEFRLevel } from '../../main/database/models';
import styles from './TopicCreationPage.module.scss';

type Step = 'idle' | 'recording' | 'processing' | 'result' | 'saving' | 'complete';

// localStorage 키
const STEP1_STORAGE_KEY = 'step1_draft_topic';

// 임시 저장할 토픽 데이터 구조
interface Step1DraftTopic {
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  title: string;
  recordingPath: string | null;
  savedAt: number;
}

interface TopicCreationState {
  step: Step;
  recordingPath: string | null;
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  title: string;
  isProcessing: boolean;
  error: string | null;
  processingMessage: string;
}

export const TopicCreationPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<TopicCreationState>({
    step: 'idle',
    recordingPath: null,
    koreanText: '',
    englishText: '',
    keywords: [],
    cefrLevel: 'B1',
    title: '',
    isProcessing: false,
    error: null,
    processingMessage: '',
  });

  // 컴포넌트 마운트 시 localStorage에서 저장된 상태 복원
  useEffect(() => {
    const saved = localStorage.getItem(STEP1_STORAGE_KEY);
    if (saved) {
      try {
        const draft: Step1DraftTopic = JSON.parse(saved);
        // englishText가 있으면 결과 화면으로 복원
        if (draft.englishText) {
          setState((prev) => ({
            ...prev,
            koreanText: draft.koreanText,
            englishText: draft.englishText,
            keywords: draft.keywords,
            cefrLevel: draft.cefrLevel,
            title: draft.title,
            recordingPath: draft.recordingPath,
            step: 'result',
          }));
        }
      } catch (e) {
        // 파싱 실패 시 저장된 데이터 삭제
        localStorage.removeItem(STEP1_STORAGE_KEY);
      }
    }
  }, []);

  // localStorage에 상태 저장하는 헬퍼 함수
  const saveDraftToStorage = (draft: Partial<Step1DraftTopic>) => {
    const currentDraft: Step1DraftTopic = {
      koreanText: draft.koreanText ?? state.koreanText,
      englishText: draft.englishText ?? state.englishText,
      keywords: draft.keywords ?? state.keywords,
      cefrLevel: draft.cefrLevel ?? state.cefrLevel,
      title: draft.title ?? state.title,
      recordingPath: draft.recordingPath ?? state.recordingPath,
      savedAt: Date.now(),
    };
    localStorage.setItem(STEP1_STORAGE_KEY, JSON.stringify(currentDraft));
  };

  // localStorage 클리어
  const clearDraftFromStorage = () => {
    localStorage.removeItem(STEP1_STORAGE_KEY);
  };

  // 녹음 완료 처리
  const handleRecordingComplete = async (filePath: string) => {
    setState((prev) => ({
      ...prev,
      recordingPath: filePath,
      step: 'processing',
      processingMessage: '음성을 텍스트로 변환하는 중...',
      isProcessing: true,
      error: null,
    }));

    try {
      // STT 요청
      const response = await window.electron.invoke('transcribe-audio', {
        filePath,
        language: 'ko',
      });

      // IPC 성공 + STT 성공 + 텍스트가 있는 경우만 진행
      if (response.success && response.data && response.data.success && response.data.text) {
        setState((prev) => ({
          ...prev,
          koreanText: response.data.text,
          processingMessage: 'AI가 영어로 변환하는 중...',
        }));

        // 자동으로 AI 변환 시작
        await handleGenerateTopic(response.data.text);
      } else {
        // STT 결과에서 에러 메시지 추출
        const errorMessage = response.data?.error || response.error || '음성 인식에 실패했습니다.';
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
          step: prev.englishText ? 'result' : 'idle',
          processingMessage: '',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: '음성 인식 중 오류가 발생했습니다.',
        step: prev.englishText ? 'result' : 'idle',
        processingMessage: '',
      }));
    }
  };

  // 녹음 에러 처리
  const handleRecordingError = (error: string) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  };

  // CEFR 레벨 변경
  const handleCEFRLevelChange = (level: CEFRLevel) => {
    setState((prev) => ({
      ...prev,
      cefrLevel: level,
    }));
  };

  // AI 영어 변환
  const handleGenerateTopic = async (koreanText?: string) => {
    const textToTranslate = koreanText || state.koreanText;

    if (!textToTranslate) {
      setState((prev) => ({
        ...prev,
        error: '변환할 텍스트가 없습니다.',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      error: null,
      step: 'processing',
      processingMessage: 'AI가 영어로 변환하는 중...',
    }));

    try {
      const response = await window.electron.invoke('generate-topic', {
        koreanText: textToTranslate,
        cefrLevel: state.cefrLevel,
      });

      if (response.success && response.data) {
        // 자동 제목 생성 (한국어 텍스트 첫 50자)
        const autoTitle =
          textToTranslate.substring(0, 50).trim() + (textToTranslate.length > 50 ? '...' : '');

        setState((prev) => ({
          ...prev,
          englishText: response.data.englishText,
          keywords: response.data.keywords,
          title: autoTitle,
          step: 'result',
          isProcessing: false,
          processingMessage: '',
        }));

        // localStorage에 저장 (탭 이동 시 유지)
        saveDraftToStorage({
          koreanText: textToTranslate,
          englishText: response.data.englishText,
          keywords: response.data.keywords,
          cefrLevel: state.cefrLevel,
          title: autoTitle,
          recordingPath: state.recordingPath,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: response.error || 'AI 영어 변환에 실패했습니다.',
          step: prev.englishText ? 'result' : 'idle',
          processingMessage: '',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: 'AI 변환 중 오류가 발생했습니다.',
        step: prev.englishText ? 'result' : 'idle',
        processingMessage: '',
      }));
    }
  };

  // 토픽 저장
  const handleTopicSave = async () => {
    setState((prev) => ({
      ...prev,
      isProcessing: true,
      step: 'saving',
      processingMessage: '토픽을 저장하는 중...',
      error: null,
    }));

    try {
      const response = await window.electron.invoke('save-topic', {
        title: state.title,
        koreanContent: state.koreanText,
        englishContent: state.englishText,
        cefrLevel: state.cefrLevel,
        keywords: state.keywords,
        recordingPath: state.recordingPath,
      });

      if (response.success) {
        setState((prev) => ({
          ...prev,
          step: 'complete',
          isProcessing: false,
          processingMessage: '',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: response.error || '토픽 저장에 실패했습니다.',
          step: 'result',
          processingMessage: '',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: '토픽 저장 중 오류가 발생했습니다.',
        step: 'result',
        processingMessage: '',
      }));
    }
  };

  // 재시도
  const handleRetry = () => {
    // 새 토픽 시작 시 localStorage 클리어
    clearDraftFromStorage();

    setState({
      step: 'idle',
      recordingPath: null,
      koreanText: '',
      englishText: '',
      keywords: [],
      cefrLevel: state.cefrLevel,
      title: '',
      isProcessing: false,
      error: null,
      processingMessage: '',
    });
  };

  // 제목 변경
  const handleTitleChange = (newTitle: string) => {
    setState((prev) => ({ ...prev, title: newTitle }));
    // 제목 변경 시 localStorage 업데이트
    saveDraftToStorage({ title: newTitle });
  };

  // 재생성 (수정된 한국어 텍스트로)
  const handleRegenerate = (editedKoreanText: string) => {
    // 수정된 텍스트로 상태 업데이트 후 재생성
    setState((prev) => ({
      ...prev,
      koreanText: editedKoreanText,
    }));
    handleGenerateTopic(editedKoreanText);
  };

  const isMainUIVisible = state.step !== 'saving' && state.step !== 'complete';
  const isProcessing = state.step === 'processing';

  return (
    <div className={styles.page}>
      {/* 에러 메시지 */}
      {state.error && (
        <div className="error-message">
          <p>{state.error}</p>
          <button onClick={handleRetry} className="btn-retry">
            재시도
          </button>
        </div>
      )}

      {/* 메인 UI (설명/녹음/결과) */}
      {isMainUIVisible && (
        <div className={styles.stepContainer}>
          {/* CEFR 선택기 - 결과가 있을 때는 비활성화 */}
          <CEFRSelector
            value={state.cefrLevel}
            onChange={handleCEFRLevelChange}
            showDescriptions={true}
            disabled={isProcessing || state.step === 'result'}
          />

          {/* 녹음 UI */}
          <VoiceRecorder
            maxDuration={30}
            onRecordingComplete={handleRecordingComplete}
            onRecordingError={handleRecordingError}
            disabled={isProcessing}
          />

          {/* 설명 텍스트 */}
          <div className={styles.instructions}>
            <p>영어 1분 스피치를 하기 위한 관심있는 토픽에 대해 한국어로 40초 정도 말씀해 주세요. AI가 선택한 CEFR 레벨에 맞는 수준의 영어로 변환합니다.</p>
            <p>예: 최근 관심사, 취미, 배우고 싶은 것 등</p>
          </div>

          {/* 처리 중 인디케이터 (인라인) */}
          {isProcessing && (
            <div className={styles.processingIndicator}>
              <LoadingSpinner message={state.processingMessage} fullScreen={false} />
            </div>
          )}

          {/* 결과 영역 */}
          {state.step === 'result' && (
            <TopicPreview
              title={state.title}
              koreanText={state.koreanText}
              englishText={state.englishText}
              keywords={state.keywords}
              cefrLevel={state.cefrLevel}
              recordingPath={state.recordingPath}
              onConfirm={handleTopicSave}
              onRegenerate={handleRegenerate}
              onTitleChange={handleTitleChange}
              onCancel={handleRetry}
              inline={true}
            />
          )}
        </div>
      )}

      {/* 저장 중 */}
      {state.step === 'saving' && (
        <LoadingSpinner message={state.processingMessage} fullScreen={true} />
      )}

      {/* 완료 */}
      {state.step === 'complete' && (
        <div className={styles.completionMessage}>
          <h2>토픽 생성 완료!</h2>
          <p>1주일 정도의 시간을 가지고 이 토픽으로 학습을 반복하는 것을 추천합니다.</p>
          <button onClick={() => navigate('/listening')} className={styles.btnNext}>
            다음 단계로
          </button>
          <button onClick={handleRetry} className={styles.btnNewTopic}>
            새 토픽 만들기
          </button>
        </div>
      )}
    </div>
  );
};

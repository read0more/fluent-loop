import React, { useState } from 'react';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CEFRSelector } from '../components/CEFRSelector';
import { TopicPreview } from '../components/TopicPreview';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CEFRLevel } from '../../main/database/models';

type Step = 'recording' | 'transcribing' | 'translating' | 'preview' | 'saving' | 'complete';

interface TopicCreationState {
  step: Step;
  recordingPath: string | null;
  koreanText: string;
  englishText: string;
  keywords: string[];
  cefrLevel: CEFRLevel;
  isProcessing: boolean;
  error: string | null;
}

export const TopicCreationPage: React.FC = () => {
  const [state, setState] = useState<TopicCreationState>({
    step: 'recording',
    recordingPath: null,
    koreanText: '',
    englishText: '',
    keywords: [],
    cefrLevel: 'B1',
    isProcessing: false,
    error: null,
  });

  // 녹음 완료 처리
  const handleRecordingComplete = async (filePath: string) => {
    setState((prev) => ({
      ...prev,
      recordingPath: filePath,
      step: 'transcribing',
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
          step: 'translating',
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
          step: 'recording',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: '음성 인식 중 오류가 발생했습니다.',
        step: 'recording',
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
      step: 'translating',
    }));

    try {
      const response = await window.electron.invoke('generate-topic', {
        koreanText: textToTranslate,
        cefrLevel: state.cefrLevel,
      });

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          englishText: response.data.englishText,
          keywords: response.data.keywords,
          step: 'preview',
          isProcessing: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: response.error || 'AI 영어 변환에 실패했습니다.',
          step: 'recording',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: 'AI 변환 중 오류가 발생했습니다.',
        step: 'recording',
      }));
    }
  };

  // 토픽 저장
  const handleTopicSave = async () => {
    setState((prev) => ({
      ...prev,
      isProcessing: true,
      step: 'saving',
      error: null,
    }));

    try {
      // 제목 생성 (첫 문장의 처음 50자)
      const title = state.koreanText.substring(0, 50).trim() + (state.koreanText.length > 50 ? '...' : '');

      const response = await window.electron.invoke('save-topic', {
        title,
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
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: response.error || '토픽 저장에 실패했습니다.',
          step: 'preview',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: '토픽 저장 중 오류가 발생했습니다.',
        step: 'preview',
      }));
    }
  };

  // 재시도
  const handleRetry = () => {
    setState({
      step: 'recording',
      recordingPath: null,
      koreanText: '',
      englishText: '',
      keywords: [],
      cefrLevel: state.cefrLevel,
      isProcessing: false,
      error: null,
    });
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

  return (
    <div className="topic-creation-page">
      <h1>단계 1: 토픽 선택</h1>

      {/* 에러 메시지 */}
      {state.error && (
        <div className="error-message">
          <p>{state.error}</p>
          <button onClick={handleRetry} className="btn-retry">
            재시도
          </button>
        </div>
      )}

      {/* 녹음 단계 */}
      {state.step === 'recording' && !state.error && (
        <div className="step-container">
          <CEFRSelector
            value={state.cefrLevel}
            onChange={handleCEFRLevelChange}
            showDescriptions={true}
          />

          <VoiceRecorder
            maxDuration={30}
            onRecordingComplete={handleRecordingComplete}
            onRecordingError={handleRecordingError}
          />

          <div className="instructions">
            <p>영어 1분 스피치를 하기 위한 관심있는 토픽에 대해 한국어로 40초 정도 말씀해 주세요. AI가 선택한 CEFR 레벨에 맞는 수준의 영어로 변환합니다.</p>
            <p>예: 최근 관심사, 취미, 배우고 싶은 것 등</p>
          </div>
        </div>
      )}

      {/* STT 처리 중 */}
      {state.step === 'transcribing' && (
        <LoadingSpinner message="음성을 텍스트로 변환하는 중..." fullScreen={true} />
      )}

      {/* AI 변환 중 */}
      {state.step === 'translating' && (
        <LoadingSpinner message="AI가 영어로 변환하는 중..." fullScreen={true} />
      )}

      {/* 미리보기 */}
      {state.step === 'preview' && (
        <TopicPreview
          koreanText={state.koreanText}
          englishText={state.englishText}
          keywords={state.keywords}
          cefrLevel={state.cefrLevel}
          recordingPath={state.recordingPath}
          onConfirm={handleTopicSave}
          onRegenerate={handleRegenerate}
          onCancel={handleRetry}
        />
      )}

      {/* 저장 중 */}
      {state.step === 'saving' && (
        <LoadingSpinner message="토픽을 저장하는 중..." fullScreen={true} />
      )}

      {/* 완료 */}
      {state.step === 'complete' && (
        <div className="completion-message">
          <h2>토픽 생성 완료!</h2>
          <p>1주일간 이 토픽으로 학습하게 됩니다.</p>
          <button onClick={() => {/* 다음 단계로 이동 */}} className="btn-next">
            다음 단계로
          </button>
          <button onClick={handleRetry} className="btn-new-topic">
            새 토픽 만들기
          </button>
        </div>
      )}
    </div>
  );
};

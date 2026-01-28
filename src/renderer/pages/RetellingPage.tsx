import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from '../components/Timer';
import { KeywordDisplay } from '../components/KeywordDisplay';
import { ProgressTracker } from '../components/ProgressTracker';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Topic, TranscribeRetellingResult, stepToDuration } from '../../main/database/models';
import styles from './RetellingPage.module.scss';

export type RetellingStep = 'loading' | 'no-topic' | 'ready' | 'timer-running' | 'complete';

export interface RetellingPageState {
  step: RetellingStep;
  topic: Topic | null;
  currentTimerStep: 1 | 2 | 3;
  completedSteps: number[];
  error: string | null;
  isTimerRunning: boolean;
  isRecording: boolean;
  isProcessingSTT: boolean;
  transcribedTexts: Record<1 | 2 | 3, string | null>;
}

export const DURATIONS: Record<1 | 2 | 3, number> = {
  1: 180, // 3분
  2: 120, // 2분
  3: 60,  // 1분
};

export const RetellingPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<RetellingPageState>({
    step: 'loading',
    topic: null,
    currentTimerStep: 1,
    completedSteps: [],
    error: null,
    isTimerRunning: false,
    isRecording: false,
    isProcessingSTT: false,
    transcribedTexts: { 1: null, 2: null, 3: null },
  });

  // 녹음 관련 refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Load active topic
  const loadActiveTopic = async () => {
    setState((prev) => ({ ...prev, step: 'loading', error: null }));

    try {
      // 1. 활성 토픽 조회
      const response = await window.electron.invoke('get-active-topic');

      if (!response.success) {
        throw new Error(response.error || 'Unknown error');
      }

      if (!response.data) {
        setState({
          step: 'no-topic',
          topic: null,
          currentTimerStep: 1,
          completedSteps: [],
          error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
          isTimerRunning: false,
          isRecording: false,
          isProcessingSTT: false,
          transcribedTexts: { 1: null, 2: null, 3: null },
        });
        return;
      }

      const topic = response.data;

      // 2. 리텔링 상태 복원 (추가)
      const retellingResponse = await window.electron.invoke('get-retelling-texts', {
        topicId: topic.id,
      });

      let completedSteps: number[] = [];
      let transcribedTexts: Record<1 | 2 | 3, string | null> = {
        1: null,
        2: null,
        3: null,
      };
      let nextStep: 1 | 2 | 3 = 1;

      // 3. 응답 데이터 기반 상태 복원
      if (retellingResponse.success && retellingResponse.data) {
        const { threeMin, twoMin, oneMin } = retellingResponse.data;

        // duration=3 → step=1 (3분 리텔링)
        if (threeMin) {
          completedSteps.push(1);
          transcribedTexts[1] = threeMin;
          nextStep = 2;
        }

        // duration=2 → step=2 (2분 리텔링)
        if (twoMin) {
          completedSteps.push(2);
          transcribedTexts[2] = twoMin;
          nextStep = 3;
        }

        // duration=1 → step=3 (1분 리텔링)
        if (oneMin) {
          completedSteps.push(3);
          transcribedTexts[3] = oneMin;
          // nextStep은 3으로 유지 (모든 스텝 완료)
        }
      } else {
        // 조회 실패 시에도 빈 상태로 계속 진행 (Graceful degradation)
        console.warn('Failed to load retelling state, starting fresh:', retellingResponse.error);
      }

      // 4. 상태 업데이트
      setState({
        step: completedSteps.length === 3 ? 'complete' : 'ready',
        topic,
        currentTimerStep: nextStep,
        completedSteps,
        error: null,
        isTimerRunning: false,
        isRecording: false,
        isProcessingSTT: false,
        transcribedTexts,
      });
    } catch (error) {
      console.error('Failed to load active topic:', error);
      setState((prev) => ({
        ...prev,
        step: 'no-topic',
        error: '토픽을 불러오는 중 오류가 발생했습니다.',
      }));
    }
  };

  // Handle timer select
  const handleTimerSelect = (timerStep: 1 | 2 | 3) => {
    setState((prev) => ({
      ...prev,
      currentTimerStep: timerStep,
      isTimerRunning: false,
    }));
  };

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;

      // 녹음 시작 시각 기록
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.start(1000); // 1초마다 데이터 수집

      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      setState((prev) => ({
        ...prev,
        error: '마이크 접근 권한이 필요합니다.',
      }));
    }
  }, []);

  /**
   * 녹음 상태 및 리소스 정리
   * - Timer 중지 시 호출
   * - MediaRecorder 정리
   * - MediaStream tracks 중지
   * - refs 초기화
   */
  const cleanupRecording = useCallback(() => {
    console.log('[Cleanup] Starting recording cleanup');

    try {
      // MediaRecorder 정리
      if (mediaRecorderRef.current) {
        const recorder = mediaRecorderRef.current;

        // MediaRecorder 상태 확인 후 정리
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch (error) {
            console.warn('[Cleanup] MediaRecorder.stop() failed:', error);
          }
        }

        // MediaStream tracks 중지 (마이크 권한 해제)
        try {
          recorder.stream.getTracks().forEach((track) => {
            track.stop();
            console.log('[Cleanup] Stopped track:', track.kind);
          });
        } catch (error) {
          console.warn('[Cleanup] Failed to stop stream tracks:', error);
        }

        mediaRecorderRef.current = null;
      }

      // 녹음 데이터 초기화
      audioChunksRef.current = [];
      recordingStartTimeRef.current = null;

      // UI 상태 업데이트
      setState((prev) => ({
        ...prev,
        isRecording: false,
      }));

      console.log('[Cleanup] Recording cleanup completed');
    } catch (error) {
      // 최상위 에러 핸들러
      console.error('[Cleanup] Unexpected error during cleanup:', error);

      // 최소한의 상태 정리
      setState((prev) => ({
        ...prev,
        isRecording: false,
        error: '녹음 정리 중 오류가 발생했습니다.',
      }));
    }
  }, []);

  // 녹음 중지 및 STT 변환
  const stopRecordingAndTranscribe = useCallback(async () => {
    if (!mediaRecorderRef.current || !state.topic) return;

    const currentStep = state.currentTimerStep;
    const duration = stepToDuration(currentStep);

    // 실제 녹음 시간 계산
    const actualDuration = recordingStartTimeRef.current
      ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
      : 0;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        // 스트림 정리
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioData = new Uint8Array(arrayBuffer);

        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessingSTT: true,
        }));

        try {
          const response = await window.electron.invoke('transcribe-retelling', {
            topicId: state.topic!.id,
            duration,
            audioData,
            actualDuration,
          });

          if (response.success && response.data) {
            const result = response.data as TranscribeRetellingResult;
            setState((prev) => ({
              ...prev,
              isProcessingSTT: false,
              transcribedTexts: {
                ...prev.transcribedTexts,
                [currentStep]: result.transcribedText,
              },
            }));
          } else {
            setState((prev) => ({
              ...prev,
              isProcessingSTT: false,
              error: response.error || 'STT 변환에 실패했습니다.',
            }));
          }
        } catch (error) {
          console.error('STT 변환 오류:', error);
          setState((prev) => ({
            ...prev,
            isProcessingSTT: false,
            error: 'STT 변환 중 오류가 발생했습니다.',
          }));
        } finally {
          // 시작 시각 초기화
          recordingStartTimeRef.current = null;
        }

        resolve();
      };

      mediaRecorder.stop();
    });
  }, [state.topic, state.currentTimerStep]);

  // Handle timer complete
  const handleTimerComplete = async () => {
    // 녹음 중지 및 STT 변환
    if (state.isRecording) {
      await stopRecordingAndTranscribe();
    }

    setState((prev) => {
      const newCompletedSteps = [...prev.completedSteps];
      if (!newCompletedSteps.includes(prev.currentTimerStep)) {
        newCompletedSteps.push(prev.currentTimerStep);
      }

      // Check if all steps are completed
      if (newCompletedSteps.length === 3) {
        return {
          ...prev,
          step: 'complete',
          completedSteps: newCompletedSteps,
          isTimerRunning: false,
        };
      }

      // Move to next step
      const nextStep = (prev.currentTimerStep + 1) as 1 | 2 | 3;
      return {
        ...prev,
        currentTimerStep: nextStep,
        completedSteps: newCompletedSteps,
        isTimerRunning: false,
      };
    });

    // Play notification sound (optional)
    playNotificationSound();
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/assets/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore error if sound cannot be played
      });
    } catch {
      // Ignore error
    }
  };

  // Load topic on mount
  useEffect(() => {
    loadActiveTopic();
  }, []);

  return (
    <div className={styles.page}>
      {/* Error message */}
      {state.error && state.step !== 'no-topic' && (
        <div className="error-message">
          <p>{state.error}</p>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))} className={styles.btnDismiss}>
            닫기
          </button>
        </div>
      )}

      {/* Loading */}
      {state.step === 'loading' && <LoadingSpinner message="토픽을 불러오는 중..." fullScreen={false} />}

      {/* No topic */}
      {state.step === 'no-topic' && (
        <div className={styles.noTopicMessage}>
          <p>{state.error}</p>
          <button onClick={loadActiveTopic} className="btn-retry">
            다시 시도
          </button>
        </div>
      )}

      {/* Main content */}
      {(state.step === 'ready' || state.step === 'complete') && state.topic && (
        <div className={styles.content}>
          {/* Topic info */}
          <div className={styles.topicInfo}>
            <h2 data-testid="topic-title">{state.topic.title}</h2>
            <div className={styles.topicLevel}>CEFR Level: {state.topic.cefrLevel}</div>
          </div>

          {/* Progress tracker */}
          <ProgressTracker
            currentStep={state.currentTimerStep}
            completedSteps={state.completedSteps}
            topicId={state.topic.id}
            showHistory={true}
          />

          {/* Keywords */}
          <KeywordDisplay keywords={state.topic.keywords} />

          {/* Timer selection */}
          {state.step !== 'complete' && (
            <div className={styles.timerSelection}>
              <div className={styles.timerSelectionHeader}>
                <h3>타이머 선택</h3>
                <button
                  onClick={async () => {
                    // TTS 캐시 삭제 (새로운 학습 세션 시작)
                    await window.electron.invoke('clear-tts-cache').catch((err) => {
                      console.warn('Failed to clear TTS cache:', err);
                    });

                    if (state.topic) {
                      await window.electron.invoke('delete-retellings', {
                        topicId: state.topic.id,
                      });
                    }
                    setState((prev) => ({
                      ...prev,
                      currentTimerStep: 1,
                      completedSteps: [],
                      step: 'ready',
                      transcribedTexts: { 1: null, 2: null, 3: null },
                    }));
                  }}
                  className={styles.btnRestartSmall}
                  disabled={state.isTimerRunning}
                >
                  다시 시작
                </button>
              </div>
              <div className={styles.timerButtons}>
                <button
                  onClick={() => handleTimerSelect(1)}
                  className={`${styles.btnTimerSelect} ${state.currentTimerStep === 1 ? styles.active : ''} ${state.completedSteps.includes(1) ? styles.completed : ''}`}
                  disabled={state.isTimerRunning}
                >
                  3분 {state.completedSteps.includes(1) && '✓'}
                </button>
                <button
                  onClick={() => handleTimerSelect(2)}
                  className={`${styles.btnTimerSelect} ${state.currentTimerStep === 2 ? styles.active : ''} ${state.completedSteps.includes(2) ? styles.completed : ''}`}
                  disabled={state.isTimerRunning}
                >
                  2분 {state.completedSteps.includes(2) && '✓'}
                </button>
                <button
                  onClick={() => handleTimerSelect(3)}
                  className={`${styles.btnTimerSelect} ${state.currentTimerStep === 3 ? styles.active : ''} ${state.completedSteps.includes(3) ? styles.completed : ''}`}
                  disabled={state.isTimerRunning}
                >
                  1분 {state.completedSteps.includes(3) && '✓'}
                </button>
              </div>
            </div>
          )}

          {/* Timer section */}
          {state.step !== 'complete' && !state.isProcessingSTT && (
            <div className={styles.timerSection}>
              {state.isRecording && (
                <div className={styles.recordingIndicator}>
                  <span className={styles.recordingDot}></span>
                  녹음 중...
                </div>
              )}
              <Timer
                duration={DURATIONS[state.currentTimerStep]}
                label={`${state.currentTimerStep === 1 ? '3분' : state.currentTimerStep === 2 ? '2분' : '1분'} 타이머`}
                onStart={startRecording}
                onStop={cleanupRecording}
                onComplete={handleTimerComplete}
                onManualComplete={handleTimerComplete}
                showCompleteButton={true}
                onTick={(remaining) => {
                  setState((prev) => ({ ...prev, isTimerRunning: remaining > 0 }));
                }}
              />
            </div>
          )}

          {/* STT Processing */}
          {state.isProcessingSTT && (
            <div className={styles.sttProcessing}>
              <LoadingSpinner message="음성을 텍스트로 변환 중..." fullScreen={false} />
            </div>
          )}

          {/* Completion message */}
          {state.step === 'complete' && (
            <div className={styles.completionMessage}>
              <h2>모든 단계를 완료했습니다!</h2>
              <p>3분, 2분, 1분 리텔링을 모두 완료하셨습니다.</p>
              <div className={styles.completionButtons}>
                <button
                  onClick={async () => {
                    // 1. DB의 리텔링 데이터 삭제
                    if (state.topic) {
                      await window.electron.invoke('delete-retellings', {
                        topicId: state.topic.id,
                      });
                    }
                    // 2. UI 상태 초기화 (transcribedTexts 포함)
                    setState((prev) => ({
                      ...prev,
                      currentTimerStep: 1,
                      completedSteps: [],
                      step: 'ready',
                      transcribedTexts: { 1: null, 2: null, 3: null },
                    }));
                  }}
                  className={styles.btnRestart}
                >
                  다시 시작
                </button>
                <button onClick={() => navigate('/correction')} className={styles.btnNextStep}>
                  다음 단계로 (첨삭)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

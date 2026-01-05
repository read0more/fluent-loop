import React, { useState, useEffect, useRef } from 'react';
import { Timer } from '../components/Timer';
import { KeywordDisplay } from '../components/KeywordDisplay';
import { ProgressTracker } from '../components/ProgressTracker';
import { AudioPlayer } from '../components/AudioPlayer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Topic } from '../../main/database/models';

export type RetellingStep = 'loading' | 'no-topic' | 'ready' | 'timer-running' | 'recording' | 'complete';

export interface RetellingPageState {
  step: RetellingStep;
  topic: Topic | null;
  currentTimerStep: 1 | 2 | 3;
  completedSteps: number[];
  selectedRecording: string | null;
  error: string | null;
  isTimerRunning: boolean;
  isRecording: boolean;
}

export const DURATIONS: Record<1 | 2 | 3, number> = {
  1: 180, // 3분
  2: 120, // 2분
  3: 60,  // 1분
};

export const RetellingPage: React.FC = () => {
  const [state, setState] = useState<RetellingPageState>({
    step: 'loading',
    topic: null,
    currentTimerStep: 1,
    completedSteps: [],
    selectedRecording: null,
    error: null,
    isTimerRunning: false,
    isRecording: false,
  });

  const [recordings, setRecordings] = useState<Array<{ fileName: string; filePath: string; createdAt: Date; size: number }>>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load active topic
  const loadActiveTopic = async () => {
    setState((prev) => ({ ...prev, step: 'loading', error: null }));

    try {
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
          selectedRecording: null,
          error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
          isTimerRunning: false,
          isRecording: false,
        });
        return;
      }

      setState({
        step: 'ready',
        topic: response.data,
        currentTimerStep: 1,
        completedSteps: [],
        selectedRecording: null,
        error: null,
        isTimerRunning: false,
        isRecording: false,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        step: 'no-topic',
        error: '토픽을 불러오는 중 오류가 발생했습니다.',
      }));
    }
  };

  // Load recordings for current duration
  const loadRecordings = async () => {
    try {
      const response = await window.electron.invoke('list-recordings-step3', {
        duration: state.currentTimerStep === 1 ? 3 : state.currentTimerStep === 2 ? 2 : 1,
      });

      if (response.success && response.data) {
        setRecordings(response.data);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  // Handle timer complete
  const handleTimerComplete = () => {
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

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setState((prev) => ({ ...prev, step: 'loading' }));

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
          const buffer = await audioBlob.arrayBuffer();

          const duration = state.currentTimerStep === 1 ? 3 : state.currentTimerStep === 2 ? 2 : 1;

          const response = await window.electron.invoke('stop-recording-step3', {
            duration,
            audioData: new Uint8Array(buffer),
          });

          if (response.success && response.data) {
            setState((prev) => ({ ...prev, step: 'ready', isRecording: false }));
            setRecordingTime(0);
            await loadRecordings();
          } else {
            setState((prev) => ({
              ...prev,
              step: 'ready',
              isRecording: false,
              error: response.error || '녹음 저장에 실패했습니다.',
            }));
          }
        } catch {
          setState((prev) => ({
            ...prev,
            step: 'ready',
            isRecording: false,
            error: '녹음 처리 중 오류가 발생했습니다.',
          }));
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      const duration = state.currentTimerStep === 1 ? 3 : state.currentTimerStep === 2 ? 2 : 1;
      const response = await window.electron.invoke('start-recording-step3', { duration });

      if (!response.success) {
        stream.getTracks().forEach((track) => track.stop());
        setState((prev) => ({
          ...prev,
          error: response.error || '녹음 시작에 실패했습니다.',
        }));
        return;
      }

      recorder.start();
      setMediaRecorder(recorder);
      setState((prev) => ({ ...prev, isRecording: true, error: null }));
      setRecordingTime(0);

      // Start recording timer
      const maxDuration = DURATIONS[state.currentTimerStep];
      const intervalId = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);

      recordingTimerRef.current = intervalId;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setState((prev) => ({
            ...prev,
            error: '마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          }));
        } else if (error.name === 'NotFoundError') {
          setState((prev) => ({
            ...prev,
            error: '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            error: '녹음 시작에 실패했습니다.',
          }));
        }
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Handle recording select
  const handleRecordingSelect = (filePath: string) => {
    setState((prev) => ({
      ...prev,
      selectedRecording: filePath,
    }));
  };

  // Handle recording delete
  const handleRecordingDelete = async (filePath: string) => {
    try {
      const response = await window.electron.invoke('delete-recording-step3', { filePath });

      if (response.success) {
        if (state.selectedRecording === filePath) {
          setState((prev) => ({ ...prev, selectedRecording: null }));
        }
        await loadRecordings();
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Load recordings when step changes
  useEffect(() => {
    if (state.step === 'ready' || state.step === 'recording') {
      loadRecordings();
    }
  }, [state.currentTimerStep, state.step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="retelling-page">
      <h1>단계 3: 리텔링 (3/2/1분)</h1>

      {/* Error message */}
      {state.error && state.step !== 'no-topic' && (
        <div className="error-message">
          <p>{state.error}</p>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))} className="btn-dismiss">
            닫기
          </button>
        </div>
      )}

      {/* Loading */}
      {state.step === 'loading' && <LoadingSpinner message="토픽을 불러오는 중..." fullScreen={false} />}

      {/* No topic */}
      {state.step === 'no-topic' && (
        <div className="no-topic-message">
          <p>{state.error}</p>
          <button onClick={loadActiveTopic} className="btn-retry">
            다시 시도
          </button>
        </div>
      )}

      {/* Main content */}
      {(state.step === 'ready' || state.step === 'recording' || state.step === 'complete') && state.topic && (
        <div className="retelling-content">
          {/* Topic info */}
          <div className="topic-info">
            <h2 data-testid="topic-title">{state.topic.title}</h2>
            <div className="topic-level">CEFR Level: {state.topic.cefrLevel}</div>
          </div>

          {/* Progress tracker */}
          <ProgressTracker currentStep={state.currentTimerStep} completedSteps={state.completedSteps} />

          {/* Keywords */}
          <KeywordDisplay keywords={state.topic.keywords} />

          {/* Timer section */}
          {state.step !== 'complete' && (
            <div className="timer-section">
              <Timer
                duration={DURATIONS[state.currentTimerStep]}
                label={`${state.currentTimerStep}차: ${
                  state.currentTimerStep === 1 ? '3분' : state.currentTimerStep === 2 ? '2분' : '1분'
                }`}
                onComplete={handleTimerComplete}
                onTick={(remaining) => {
                  setState((prev) => ({ ...prev, isTimerRunning: remaining > 0 }));
                }}
              />
            </div>
          )}

          {/* Recording section */}
          {state.step !== 'complete' && (
            <div className="recording-section">
              <h3>녹음하기</h3>

              {!state.isRecording ? (
                <button onClick={startRecording} className="btn-record-start">
                  녹음 시작
                </button>
              ) : (
                <div className="recording-active">
                  <div className="recording-timer">
                    {formatTime(recordingTime)} / {formatTime(DURATIONS[state.currentTimerStep])}
                  </div>
                  <button onClick={stopRecording} className="btn-record-stop">
                    녹음 중지
                  </button>
                  <div className="recording-indicator">
                    <span className="pulse"></span>
                    녹음 중
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completion message */}
          {state.step === 'complete' && (
            <div className="completion-message">
              <h2>모든 단계를 완료했습니다!</h2>
              <p>3분, 2분, 1분 리텔링을 모두 완료하셨습니다.</p>
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    currentTimerStep: 1,
                    completedSteps: [],
                    step: 'ready',
                  }))
                }
                className="btn-restart"
              >
                다시 시작
              </button>
            </div>
          )}

          {/* Recording list */}
          {recordings.length > 0 && (
            <div className="recordings-list" data-testid="recording-list">
              <h3>녹음 목록</h3>
              <ul>
                {recordings.map((recording) => (
                  <li key={recording.filePath} className="recording-item">
                    <button onClick={() => handleRecordingSelect(recording.filePath)} className="btn-select">
                      {recording.fileName}
                    </button>
                    <button onClick={() => handleRecordingDelete(recording.filePath)} className="btn-delete">
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audio player */}
          {state.selectedRecording && (
            <div className="playback-section">
              <h3>내 녹음 듣기</h3>
              <AudioPlayer
                src={`file://${state.selectedRecording}`}
                showControls={true}
                showSpeedControl={false}
                data-testid="audio-player"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Timer } from '../components/Timer';
import { KeywordDisplay } from '../components/KeywordDisplay';
import { ProgressTracker } from '../components/ProgressTracker';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Topic } from '../../main/database/models';

export type RetellingStep = 'loading' | 'no-topic' | 'ready' | 'timer-running' | 'complete';

export interface RetellingPageState {
  step: RetellingStep;
  topic: Topic | null;
  currentTimerStep: 1 | 2 | 3;
  completedSteps: number[];
  error: string | null;
  isTimerRunning: boolean;
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
    error: null,
    isTimerRunning: false,
  });

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
          error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
          isTimerRunning: false,
        });
        return;
      }

      setState({
        step: 'ready',
        topic: response.data,
        currentTimerStep: 1,
        completedSteps: [],
        error: null,
        isTimerRunning: false,
      });
    } catch {
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
      {(state.step === 'ready' || state.step === 'complete') && state.topic && (
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

          {/* Timer selection */}
          {state.step !== 'complete' && (
            <div className="timer-selection">
              <h3>타이머 선택</h3>
              <div className="timer-buttons">
                <button
                  onClick={() => handleTimerSelect(1)}
                  className={`btn-timer-select ${state.currentTimerStep === 1 ? 'active' : ''} ${state.completedSteps.includes(1) ? 'completed' : ''}`}
                  disabled={state.isTimerRunning}
                >
                  3분 {state.completedSteps.includes(1) && '✓'}
                </button>
                <button
                  onClick={() => handleTimerSelect(2)}
                  className={`btn-timer-select ${state.currentTimerStep === 2 ? 'active' : ''} ${state.completedSteps.includes(2) ? 'completed' : ''}`}
                  disabled={state.isTimerRunning}
                >
                  2분 {state.completedSteps.includes(2) && '✓'}
                </button>
                <button
                  onClick={() => handleTimerSelect(3)}
                  className={`btn-timer-select ${state.currentTimerStep === 3 ? 'active' : ''} ${state.completedSteps.includes(3) ? 'completed' : ''}`}
                  disabled={state.isTimerRunning}
                >
                  1분 {state.completedSteps.includes(3) && '✓'}
                </button>
              </div>
            </div>
          )}

          {/* Timer section */}
          {state.step !== 'complete' && (
            <div className="timer-section">
              <Timer
                duration={DURATIONS[state.currentTimerStep]}
                label={`${state.currentTimerStep === 1 ? '3분' : state.currentTimerStep === 2 ? '2분' : '1분'} 타이머`}
                onComplete={handleTimerComplete}
                onManualComplete={handleTimerComplete}
                showCompleteButton={true}
                onTick={(remaining) => {
                  setState((prev) => ({ ...prev, isTimerRunning: remaining > 0 }));
                }}
              />
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
        </div>
      )}
    </div>
  );
};

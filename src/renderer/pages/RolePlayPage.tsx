import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatContainer } from '../components/step5/ChatContainer';
import { ChatInput } from '../components/step5/ChatInput';
import { ConversationTimer } from '../components/step5/ConversationTimer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useConversation } from '../hooks/useConversation';
import { Topic } from '../../main/database/models';

interface RolePlayPageState {
  topic: Topic | null;
  isLoadingTopic: boolean;
  isConversationStarted: boolean;
  elapsedTime: number;
  autoSendEnabled: boolean;
  autoSendDelay: number;
  autoListenEnabled: boolean;
  showEndConfirmation: boolean;
}

export const RolePlayPage: React.FC = () => {
  const navigate = useNavigate();

  const [state, setState] = useState<RolePlayPageState>({
    topic: null,
    isLoadingTopic: true,
    isConversationStarted: false,
    elapsedTime: 0,
    autoSendEnabled: true,
    autoSendDelay: 2,
    autoListenEnabled: false, // 수동 테스트를 위해 기본값 false
    showEndConfirmation: false,
  });

  const {
    conversation,
    messages,
    isLoading,
    error,
    startConversation,
    sendMessage,
    endConversation,
    replayTTS,
    clearError,
  } = useConversation();

  // 활성 토픽 로드
  useEffect(() => {
    loadActiveTopic();
  }, []);

  const loadActiveTopic = async () => {
    try {
      const response = await window.electron.invoke('get-active-topic');

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          topic: response.data,
          isLoadingTopic: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoadingTopic: false,
        }));
      }
    } catch (error) {
      console.error('토픽 로드 실패:', error);
      setState((prev) => ({
        ...prev,
        isLoadingTopic: false,
      }));
    }
  };

  // 대화 시작
  const handleStartConversation = async () => {
    if (!state.topic) return;

    await startConversation(state.topic.id);
    setState((prev) => ({
      ...prev,
      isConversationStarted: true,
      elapsedTime: 0,
    }));
  };

  // 메시지 전송
  const handleSendMessage = useCallback(
    async (content: string) => {
      await sendMessage(content, state.elapsedTime);
    },
    [sendMessage, state.elapsedTime]
  );

  // 대화 종료
  const handleEndConversation = async (goToCorrection: boolean) => {
    await endConversation();

    // conversationId 저장 (Step 6에서 사용)
    if (goToCorrection && conversation?.id && state.topic?.id) {
      localStorage.setItem('lastConversationId', String(conversation.id));
      localStorage.setItem('lastTopicId', String(state.topic.id));
    }

    setState((prev) => ({
      ...prev,
      showEndConfirmation: false,
      isConversationStarted: false,
    }));

    // 첨삭 페이지로 이동 또는 홈으로 이동
    if (goToCorrection) {
      navigate('/conversation-correction');
    } else {
      navigate('/');
    }
  };

  // 타이머 업데이트
  const handleTimeUpdate = useCallback((seconds: number) => {
    setState((prev) => ({ ...prev, elapsedTime: seconds }));
  }, []);

  // 로딩 중
  if (state.isLoadingTopic) {
    return (
      <div className="roleplay-page">
        <LoadingSpinner message="토픽을 불러오는 중..." fullScreen={false} />
      </div>
    );
  }

  // 토픽이 없는 경우
  if (!state.topic) {
    return (
      <div className="roleplay-page">
        <div className="no-topic-message">
          <h2>활성 토픽이 없습니다</h2>
          <p>먼저 토픽을 생성해주세요.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  // 대화 시작 전
  if (!state.isConversationStarted) {
    return (
      <div className="roleplay-page">
        <header className="page-header">
          <h1>Step 5: AI 롤플레잉</h1>
          <p className="page-subtitle">AI와 자유롭게 영어 대화를 나눠보세요</p>
        </header>

        <div className="topic-info-card">
          <h2 className="topic-title">{state.topic.title}</h2>
          <div className="topic-level">CEFR Level: {state.topic.cefrLevel}</div>
          {state.topic.keywords && state.topic.keywords.length > 0 && (
            <div className="topic-keywords">
              <strong>주요 키워드:</strong>
              <div className="keywords-list">
                {state.topic.keywords.map((keyword, index) => (
                  <span key={index} className="keyword-tag">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="conversation-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>중요 안내</h3>
            <p>이 단계에서는 중간에 단어를 찾거나 첨삭 하려 하지말고 현재 가진 지식으로 최대한 대화를 끝까지 이어가는 연습을 합니다.</p>
            <p>실수를 두려워하지 말고 자신있게 대화해보세요!</p>
            <p>권장 대화 시간: 5분 이내</p>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
            <button onClick={clearError} className="error-close">
              ✕
            </button>
          </div>
        )}

        <div className="start-conversation-section">
          <button
            onClick={handleStartConversation}
            disabled={isLoading}
            className="btn-start-conversation"
          >
            {isLoading ? '대화 준비 중...' : '대화 시작하기'}
          </button>
        </div>
      </div>
    );
  }

  // 대화 진행 중
  return (
    <div className="roleplay-page conversation-active">
      {/* Header with timer and end button */}
      <header className="conversation-header">
        <div className="header-left">
          <h2 className="conversation-topic">{state.topic.title}</h2>
          <span className="conversation-level">{state.topic.cefrLevel}</span>
        </div>

        <ConversationTimer
          isActive={state.isConversationStarted}
          onTimeUpdate={handleTimeUpdate}
        />

        <button
          onClick={() => setState((prev) => ({ ...prev, showEndConfirmation: true }))}
          className="btn-end-conversation"
          disabled={isLoading}
        >
          대화 종료
        </button>
      </header>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={clearError} className="error-close">
            ✕
          </button>
        </div>
      )}

      {/* Chat container */}
      <ChatContainer
        messages={messages}
        isAIResponding={isLoading}
        onReplayTTS={replayTTS}
      />

      {/* Chat input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isSending={isLoading}
        autoSendEnabled={state.autoSendEnabled}
        autoSendDelay={state.autoSendDelay}
        onToggleAutoSend={(enabled) =>
          setState((prev) => ({ ...prev, autoSendEnabled: enabled }))
        }
        onChangeAutoSendDelay={(delay) =>
          setState((prev) => ({ ...prev, autoSendDelay: delay }))
        }
        autoListenEnabled={state.autoListenEnabled}
        onToggleAutoListen={(enabled) =>
          setState((prev) => ({ ...prev, autoListenEnabled: enabled }))
        }
      />

      {/* End confirmation dialog */}
      {state.showEndConfirmation && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>대화를 종료하시겠습니까?</h3>
            <p>지금까지의 대화 내용이 저장됩니다.</p>
            <div className="dialog-stats">
              <div className="stat-item">
                <span className="stat-label">대화 시간:</span>
                <span className="stat-value">
                  {Math.floor(state.elapsedTime / 60)}분 {state.elapsedTime % 60}초
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">메시지 수:</span>
                <span className="stat-value">{messages.length}개</span>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                onClick={() =>
                  setState((prev) => ({ ...prev, showEndConfirmation: false }))
                }
                className="btn-cancel"
                disabled={isLoading}
              >
                취소
              </button>
              <button
                onClick={() => handleEndConversation(false)}
                className="btn-secondary"
                disabled={isLoading}
              >
                {isLoading ? '종료 중...' : '홈으로'}
              </button>
              <button
                onClick={() => handleEndConversation(true)}
                className="btn-confirm"
                disabled={isLoading}
              >
                {isLoading ? '종료 중...' : '첨삭하러 가기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CorrectedMessageItem } from '../components/step6/CorrectedMessageItem';
import {
  Topic,
  ConversationCorrectionResult,
  IPCResponse,
} from '../../main/database/models';

interface ConversationCorrectionPageState {
  conversationId: number | null;
  topicId: number | null;
  topic: Topic | null;
  corrections: ConversationCorrectionResult[];
  isLoading: boolean;
  isCorrecting: boolean;
  error: string | null;
  isPlayingAll: boolean;
  currentPlayingIndex: number;
}

export const ConversationCorrectionPage: React.FC = () => {
  const navigate = useNavigate();
  const stopPlayRef = useRef(false);

  const [state, setState] = useState<ConversationCorrectionPageState>({
    conversationId: null,
    topicId: null,
    topic: null,
    corrections: [],
    isLoading: true,
    isCorrecting: false,
    error: null,
    isPlayingAll: false,
    currentPlayingIndex: -1,
  });

  // localStorage에서 대화 정보 로드
  useEffect(() => {
    loadConversationData();
  }, []);

  const loadConversationData = async () => {
    try {
      const conversationIdStr = localStorage.getItem('lastConversationId');
      const topicIdStr = localStorage.getItem('lastTopicId');

      if (!conversationIdStr || !topicIdStr) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '첨삭할 대화가 없습니다. Step 5에서 대화를 먼저 진행해주세요.',
        }));
        return;
      }

      const conversationId = Number(conversationIdStr);
      const topicId = Number(topicIdStr);

      // 토픽 정보 로드
      const topicResponse: IPCResponse<Topic> = await window.electron.invoke(
        'get-active-topic'
      );

      setState((prev) => ({
        ...prev,
        conversationId,
        topicId,
        topic: topicResponse.success ? topicResponse.data || null : null,
        isLoading: false,
      }));
    } catch (error) {
      console.error('대화 정보 로드 실패:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: '대화 정보를 불러오는데 실패했습니다.',
      }));
    }
  };

  // 첨삭 요청
  const handleCorrectConversation = useCallback(async () => {
    if (!state.conversationId) return;

    setState((prev) => ({ ...prev, isCorrecting: true, error: null }));

    try {
      const response: IPCResponse<ConversationCorrectionResult[]> =
        await window.electron.invoke('correct-conversation', {
          conversationId: state.conversationId,
        });

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          corrections: response.data || [],
          isCorrecting: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isCorrecting: false,
          error: response.error || '첨삭 요청에 실패했습니다.',
        }));
      }
    } catch (error) {
      console.error('첨삭 요청 실패:', error);
      setState((prev) => ({
        ...prev,
        isCorrecting: false,
        error: '첨삭 요청 중 오류가 발생했습니다.',
      }));
    }
  }, [state.conversationId]);

  // TTS 재생 헬퍼 함수
  const playTTSAudio = useCallback(async (text: string): Promise<void> => {
    const response = await window.electron.invoke('synthesize-tts', text);
    if (response.success && response.data?.filePath) {
      const audio = new Audio(`file://${response.data.filePath}`);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('오디오 재생 실패'));
        audio.play().catch(reject);
      });
    }
  }, []);

  // TTS 재생
  const handlePlayTTS = useCallback(async (text: string) => {
    try {
      await playTTSAudio(text);
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  }, [playTTSAudio]);

  // 개별 문장 TTS 재생 (인덱스 표시용)
  const handlePlaySingle = useCallback(async (text: string, index: number) => {
    setState((prev) => ({ ...prev, currentPlayingIndex: index }));
    try {
      await playTTSAudio(text);
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
    setState((prev) => ({ ...prev, currentPlayingIndex: -1 }));
  }, [playTTSAudio]);

  // 전체 대화 순차 재생
  const handlePlayAll = useCallback(async () => {
    if (state.isPlayingAll || state.corrections.length === 0) return;

    stopPlayRef.current = false;
    setState((prev) => ({ ...prev, isPlayingAll: true, currentPlayingIndex: 0 }));

    for (let i = 0; i < state.corrections.length; i++) {
      // 중지 버튼이 눌렸는지 체크 (ref 사용)
      if (stopPlayRef.current) break;

      setState((prev) => ({ ...prev, currentPlayingIndex: i }));
      try {
        await playTTSAudio(state.corrections[i].corrected);
        // 문장 사이 짧은 딜레이
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error('TTS 재생 실패:', error);
        break;
      }
    }

    stopPlayRef.current = false;
    setState((prev) => ({ ...prev, isPlayingAll: false, currentPlayingIndex: -1 }));
  }, [state.isPlayingAll, state.corrections, playTTSAudio]);

  // 재생 중지
  const handleStopPlayAll = useCallback(() => {
    stopPlayRef.current = true;
    setState((prev) => ({ ...prev, isPlayingAll: false, currentPlayingIndex: -1 }));
  }, []);

  // 에러 닫기
  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // 로딩 중
  if (state.isLoading) {
    return (
      <div className="conversation-correction-page">
        <LoadingSpinner message="대화 정보를 불러오는 중..." fullScreen={false} />
      </div>
    );
  }

  // 대화 정보가 없는 경우
  if (!state.conversationId) {
    return (
      <div className="conversation-correction-page">
        <div className="no-conversation-message">
          <h2>첨삭할 대화가 없습니다</h2>
          <p>Step 5에서 AI와 대화를 먼저 진행해주세요.</p>
          <button onClick={() => navigate('/roleplay')} className="btn-primary">
            AI 롤플레잉으로 이동
          </button>
        </div>
      </div>
    );
  }

  // User 메시지 중 수정된 것 개수
  const correctedCount = state.corrections.filter(
    (c) => c.speaker === 'user' && c.original !== c.corrected
  ).length;

  const userMessageCount = state.corrections.filter(
    (c) => c.speaker === 'user'
  ).length;

  return (
    <div className="conversation-correction-page">
      <header className="page-header">
        <h1>Step 6: 대화 첨삭</h1>
        <p className="page-subtitle">AI와의 대화 내용을 첨삭받아보세요</p>
      </header>

      {/* 토픽 정보 */}
      {state.topic && (
        <div className="topic-info-card">
          <h2 className="topic-title">{state.topic.title}</h2>
          <div className="topic-level">CEFR Level: {state.topic.cefrLevel}</div>
        </div>
      )}

      {/* 에러 메시지 */}
      {state.error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {state.error}
          <button onClick={clearError} className="error-close">
            ✕
          </button>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="correction-actions">
        <button
          onClick={handleCorrectConversation}
          disabled={state.isCorrecting}
          className="btn-primary"
        >
          {state.isCorrecting ? '첨삭 중...' : '첨삭 요청'}
        </button>

        {state.corrections.length > 0 && (
          <div className="correction-stats">
            <span className="stat-item">
              총 {state.corrections.length}개 메시지
            </span>
            <span className="stat-item">
              내 메시지 {userMessageCount}개
            </span>
            <span className="stat-item highlight">
              수정됨 {correctedCount}개
            </span>
          </div>
        )}
      </div>

      {/* 첨삭 진행 중 */}
      {state.isCorrecting && (
        <div className="correcting-overlay">
          <LoadingSpinner message="AI가 대화를 분석 중입니다..." fullScreen={false} />
        </div>
      )}

      {/* 첨삭 결과 */}
      {state.corrections.length > 0 && (
        <div className="correction-messages-list">
          <h3 className="section-title">대화 내용 및 첨삭 결과</h3>
          {state.corrections.map((correction, index) => (
            <CorrectedMessageItem
              key={correction.messageId}
              correction={correction}
              index={index}
              onPlayTTS={handlePlayTTS}
            />
          ))}
        </div>
      )}

      {/* 완성된 대화 플로우 */}
      {state.corrections.length > 0 && (
        <div className="corrected-conversation-flow">
          <div className="flow-header">
            <div>
              <h3 className="section-title">완성된 대화</h3>
              <p className="flow-description">수정된 내용이 반영된 전체 대화입니다.</p>
            </div>
            <button
              onClick={state.isPlayingAll ? handleStopPlayAll : handlePlayAll}
              className={`btn-play-all ${state.isPlayingAll ? 'playing' : ''}`}
            >
              {state.isPlayingAll ? '⏹ 중지' : '▶ 전체 재생'}
            </button>
          </div>
          <div className="conversation-flow">
            {state.corrections.map((c, index) => (
              <div
                key={c.messageId}
                className={`flow-message ${c.speaker} ${state.currentPlayingIndex === index ? 'playing' : ''}`}
              >
                <div className="flow-message-header">
                  <span className="flow-speaker">{c.speaker === 'ai' ? 'AI' : 'You'}</span>
                  <button
                    onClick={() => handlePlaySingle(c.corrected, index)}
                    className="btn-play-single"
                    disabled={state.isPlayingAll}
                    title="이 문장 재생"
                  >
                    🔊
                  </button>
                </div>
                <p className="flow-text">{c.corrected}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 첨삭 전 안내 */}
      {state.corrections.length === 0 && !state.isCorrecting && (
        <div className="correction-guide">
          <div className="guide-icon">📝</div>
          <h3>대화 첨삭 안내</h3>
          <p>위의 "첨삭 요청" 버튼을 클릭하면 AI가 대화 내용을 분석합니다.</p>
          <p>여러분의 영어 문장에서 문법, 어휘, 자연스러움을 검토하고 개선점을 알려드립니다.</p>
        </div>
      )}
    </div>
  );
};

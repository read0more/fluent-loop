import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CorrectedMessageItem } from '../components/step6/CorrectedMessageItem';
import { ConversationModal } from '../components/step6/ConversationModal';
import {
  Topic,
  ConversationCorrectionResult,
  IPCResponse,
  Message,
} from '../../main/database/models';
import styles from './ConversationCorrectionPage.module.scss';

// localStorage 키
const STEP6_CORRECTIONS_STORAGE_KEY = 'step6_corrections';

// 저장할 데이터 구조
interface Step6CorrectionsDraft {
  conversationId: number;
  corrections: ConversationCorrectionResult[];
}

interface ConversationCorrectionPageState {
  conversationId: number | null;
  topicId: number | null;
  topic: Topic | null;
  corrections: ConversationCorrectionResult[];
  originalMessages: Message[];  // 원본 대화 메시지
  isLoading: boolean;
  isCorrecting: boolean;
  error: string | null;
  isPlayingAll: boolean;
  currentPlayingIndex: number;
  showConversationModal: boolean;  // 대화내용 모달 표시 여부
  // TTS 생성 중 상태
  isSynthesizing: boolean;
  synthesizingId: number | null;
}

export const ConversationCorrectionPage: React.FC = () => {
  const navigate = useNavigate();
  const stopPlayRef = useRef(false);

  // 오디오 관리용 refs
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingSingle, setIsPlayingSingle] = useState(false);

  const [state, setState] = useState<ConversationCorrectionPageState>({
    conversationId: null,
    topicId: null,
    topic: null,
    corrections: [],
    originalMessages: [],
    isLoading: true,
    isCorrecting: false,
    error: null,
    isPlayingAll: false,
    currentPlayingIndex: -1,
    showConversationModal: false,
    isSynthesizing: false,
    synthesizingId: null,
  });

  // localStorage에서 대화 정보 로드
  useEffect(() => {
    loadConversationData();
  }, []);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
      }
      stopPlayRef.current = true;
    };
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

      // 저장된 첨삭 결과 확인 (conversationId가 동일한 경우에만 복원)
      let savedCorrections: ConversationCorrectionResult[] = [];
      const savedDraft = localStorage.getItem(STEP6_CORRECTIONS_STORAGE_KEY);

      if (savedDraft) {
        try {
          const draft: Step6CorrectionsDraft = JSON.parse(savedDraft);
          if (draft.conversationId === conversationId) {
            savedCorrections = draft.corrections;
          } else {
            // conversationId가 다르면 (새 대화) 저장된 데이터 삭제
            localStorage.removeItem(STEP6_CORRECTIONS_STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(STEP6_CORRECTIONS_STORAGE_KEY);
        }
      }

      // 토픽 정보 로드
      const topicResponse: IPCResponse<Topic> = await window.electron.invoke(
        'get-active-topic'
      );

      // 대화 히스토리 로드
      const historyResponse: IPCResponse<{ messages: Message[] }> = await window.electron.invoke(
        'get-conversation-history',
        { conversationId }
      );

      setState((prev) => ({
        ...prev,
        conversationId,
        topicId,
        topic: topicResponse.success ? topicResponse.data || null : null,
        originalMessages: historyResponse.success && historyResponse.data ? historyResponse.data.messages : [],
        corrections: savedCorrections,
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

    // TTS 캐시 삭제 (새로운 첨삭 세션 시작)
    await window.electron.invoke('clear-tts-cache').catch((err) => {
      console.warn('Failed to clear TTS cache:', err);
    });

    setState((prev) => ({ ...prev, isCorrecting: true, error: null }));

    try {
      const response: IPCResponse<ConversationCorrectionResult[]> =
        await window.electron.invoke('correct-conversation', {
          conversationId: state.conversationId,
        });

      if (response.success && response.data) {
        const corrections = response.data || [];

        // localStorage에 첨삭 결과 저장
        const draft: Step6CorrectionsDraft = {
          conversationId: state.conversationId!,
          corrections,
        };
        localStorage.setItem(STEP6_CORRECTIONS_STORAGE_KEY, JSON.stringify(draft));

        setState((prev) => ({
          ...prev,
          corrections,
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

  // 현재 재생 중인 오디오 중지
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      // onerror/onended 핸들러 제거 (src='' 시 에러 트리거 방지)
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    setIsPlayingSingle(false);
  }, []);

  // TTS 재생 헬퍼 함수 (speaker에 따라 다른 음성 사용, 중복 재생 방지)
  const playTTSAudio = useCallback(async (
    text: string,
    index: number,
    speaker?: 'user' | 'ai'
  ): Promise<void> => {
    // 기존 오디오 중지
    stopCurrentAudio();

    // TTS 생성 시작
    setState(prev => ({
      ...prev,
      isSynthesizing: true,
      synthesizingId: index
    }));

    try {
      const request = speaker ? { text, speaker } : text;
      const response = await window.electron.invoke('synthesize-tts', request);

      // TTS 생성 완료
      setState(prev => ({
        ...prev,
        isSynthesizing: false,
        synthesizingId: null
      }));

      if (response.success && response.data?.filePath) {
        return new Promise<void>((resolve, reject) => {
          const audio = new Audio(`file://${response.data.filePath}`);
          currentAudioRef.current = audio;
          setIsPlayingSingle(true);

          audio.onended = () => {
            currentAudioRef.current = null;
            setIsPlayingSingle(false);
            resolve();
          };
          audio.onerror = () => {
            currentAudioRef.current = null;
            setIsPlayingSingle(false);
            reject(new Error('오디오 재생 실패'));
          };

          audio.play().catch((err) => {
            currentAudioRef.current = null;
            setIsPlayingSingle(false);
            reject(err);
          });
        });
      }
    } catch (error) {
      // 에러 발생 시 상태 복원
      setState(prev => ({
        ...prev,
        isSynthesizing: false,
        synthesizingId: null
      }));
      throw error;
    }
  }, [stopCurrentAudio]);

  // TTS 재생 (speaker 정보 포함)
  const handlePlayTTS = useCallback(async (text: string, index: number, speaker?: 'user' | 'ai') => {
    // 전체 재생 중이면 무시
    if (state.isPlayingAll) {
      return;
    }
    // playTTSAudio 내부에서 stopCurrentAudio() 호출하므로 별도 중지 로직 불필요
    try {
      await playTTSAudio(text, index, speaker);
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  }, [playTTSAudio, state.isPlayingAll]);

  // 개별 문장 TTS 재생 (인덱스 표시용, speaker 정보 포함)
  const handlePlaySingle = useCallback(async (text: string, index: number, speaker: 'user' | 'ai') => {
    setState((prev) => ({ ...prev, currentPlayingIndex: index }));
    try {
      await playTTSAudio(text, index, speaker);
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
    setState((prev) => ({ ...prev, currentPlayingIndex: -1 }));
  }, [playTTSAudio]);

  // 전체 대화 순차 재생 (각 메시지의 speaker에 따라 다른 음성 사용)
  const handlePlayAll = useCallback(async () => {
    if (state.isPlayingAll || state.corrections.length === 0) return;

    stopPlayRef.current = false;
    setState((prev) => ({ ...prev, isPlayingAll: true, currentPlayingIndex: 0 }));

    for (let i = 0; i < state.corrections.length; i++) {
      // 중지 버튼이 눌렸는지 체크 (ref 사용)
      if (stopPlayRef.current) break;

      setState((prev) => ({ ...prev, currentPlayingIndex: i }));
      try {
        const correction = state.corrections[i];
        await playTTSAudio(correction.corrected, i, correction.speaker);
        // 문장 사이 짧은 딜레이
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error('TTS 재생 실패:', error);
        break;
      }
    }

    stopPlayRef.current = false;
    setState((prev) => ({
      ...prev,
      isPlayingAll: false,
      currentPlayingIndex: -1,
      isSynthesizing: false,
      synthesizingId: null
    }));
  }, [state.isPlayingAll, state.corrections, playTTSAudio]);

  // 재생 중지
  const handleStopPlayAll = useCallback(() => {
    stopPlayRef.current = true;
    stopCurrentAudio();
    setState((prev) => ({
      ...prev,
      isPlayingAll: false,
      currentPlayingIndex: -1,
      isSynthesizing: false,
      synthesizingId: null
    }));
  }, [stopCurrentAudio]);

  // 대화내용 보기 모달 열기
  const handleShowConversation = useCallback(() => {
    setState((prev) => ({ ...prev, showConversationModal: true }));
  }, []);

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setState((prev) => ({ ...prev, showConversationModal: false }));
  }, []);

  // 에러 닫기
  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // 로딩 중
  if (state.isLoading) {
    return (
      <div className={styles.page}>
        <LoadingSpinner message="대화 정보를 불러오는 중..." fullScreen={false} />
      </div>
    );
  }

  // 대화 정보가 없는 경우
  if (!state.conversationId) {
    return (
      <div className={styles.page}>
        <div className={styles.noConversationMessage}>
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
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.pageSubtitle}>AI와의 대화 내용을 첨삭받아보세요</p>
      </header>

      {/* 토픽 정보 */}
      {state.topic && (
        <div className={styles.topicInfoCard}>
          <h2 className={styles.topicTitle}>{state.topic.title}</h2>
          <div className={styles.topicLevel}>CEFR Level: {state.topic.cefrLevel}</div>
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
      <div className={styles.correctionActions}>
        <button
          onClick={handleCorrectConversation}
          disabled={state.isCorrecting}
          className="btn-primary"
        >
          {state.isCorrecting ? '첨삭 중...' : '첨삭 요청'}
        </button>

        <button
          onClick={handleShowConversation}
          disabled={!state.originalMessages || state.originalMessages.length === 0}
          className="btn-secondary"
          title={!state.originalMessages || state.originalMessages.length === 0 ? '표시할 대화내용이 없습니다' : '5단계 대화 원본 보기'}
        >
          대화내용 보기
        </button>

        {state.corrections.length > 0 && (
          <div className={styles.correctionStats}>
            <span className={styles.statItem}>
              총 {state.corrections.length}개 메시지
            </span>
            <span className={styles.statItem}>
              내 메시지 {userMessageCount}개
            </span>
            <span className={`${styles.statItem} ${styles.highlight}`}>
              수정됨 {correctedCount}개
            </span>
          </div>
        )}
      </div>

      {/* 첨삭 진행 중 */}
      {state.isCorrecting && (
        <div className={styles.correctingOverlay}>
          <LoadingSpinner message="AI가 대화를 분석 중입니다..." fullScreen={false} />
        </div>
      )}

      {/* 첨삭 결과 */}
      {state.corrections.length > 0 && (
        <div className={styles.correctionMessagesList}>
          <h3 className={styles.sectionTitle}>대화 내용 및 첨삭 결과</h3>
          {state.corrections.map((correction, index) => (
            <CorrectedMessageItem
              key={correction.messageId}
              correction={correction}
              index={index}
              onPlayTTS={(text) => handlePlayTTS(text, index, correction.speaker)}
              isPlaying={state.currentPlayingIndex === index}
              isSynthesizing={state.isSynthesizing && state.synthesizingId === index}
            />
          ))}
        </div>
      )}

      {/* 완성된 대화 플로우 */}
      {state.corrections.length > 0 && (
        <div className={styles.correctedConversationFlow}>
          <div className={styles.flowHeader}>
            <div>
              <h3 className={styles.sectionTitle}>완성된 대화</h3>
              <p className={styles.flowDescription}>수정된 내용이 반영된 전체 대화입니다.</p>
            </div>
            <button
              onClick={state.isPlayingAll ? handleStopPlayAll : handlePlayAll}
              className={`${styles.btnPlayAll} ${state.isPlayingAll ? styles.playing : ''}`}
            >
              {state.isPlayingAll ? '⏹ 중지' : '▶ 전체 재생'}
            </button>
          </div>
          <div className={styles.conversationFlow}>
            {state.corrections.map((c, index) => (
              <div
                key={c.messageId}
                className={`${styles.flowMessage} ${styles[c.speaker]} ${state.currentPlayingIndex === index ? styles.playing : ''}`}
              >
                <div className={styles.flowMessageHeader}>
                  <span className={styles.flowSpeaker}>{c.speaker === 'ai' ? 'AI' : 'You'}</span>
                  <button
                    onClick={() => handlePlaySingle(c.corrected, index, c.speaker)}
                    className={styles.btnPlaySingle}
                    disabled={state.isPlayingAll}
                    title="이 문장 재생"
                  >
                    {state.isSynthesizing && state.synthesizingId === index
                      ? '🔄'
                      : state.currentPlayingIndex === index
                      ? '⏸️'
                      : '🔊'}
                  </button>
                </div>
                <p className={styles.flowText}>{c.corrected}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 첨삭 전 안내 */}
      {state.corrections.length === 0 && !state.isCorrecting && (
        <div className={styles.correctionGuide}>
          <div className={styles.guideIcon}>📝</div>
          <h3>대화 첨삭 안내</h3>
          <p>위의 "첨삭 요청" 버튼을 클릭하면 AI가 대화 내용을 분석합니다.</p>
          <p>여러분의 영어 문장에서 문법, 어휘, 자연스러움을 검토하고 개선점을 알려드립니다.</p>
        </div>
      )}

      {/* 대화내용 모달 */}
      <ConversationModal
        isOpen={state.showConversationModal}
        onClose={handleCloseModal}
        messages={state.originalMessages}
      />
    </div>
  );
};

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Conversation,
  Message,
  ConversationStartResult,
  MessageExchangeResult,
  ConversationEndResult,
} from '../../main/database/models';

/**
 * 대화 상태 관리 훅
 * IPC 통신 및 에러 처리
 */
export interface UseConversationReturn {
  conversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isPlayingTTS: boolean;
  error: string | null;
  startConversation: (topicId: number) => Promise<void>;
  sendMessage: (content: string, timestamp: number) => Promise<void>;
  endConversation: () => Promise<void>;
  replayTTS: (messageId: number) => Promise<void>;
  clearError: () => void;
}

export const useConversation = (): UseConversationReturn => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  // 오디오 관리용 refs
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 현재 재생 중인 오디오 중지
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    setIsPlayingTTS(false);
  }, []);

  // 안전하게 오디오 재생 (기존 오디오 중지 후 새 오디오 재생)
  const playAudioSafely = useCallback((audioPath: string) => {
    // 기존 오디오 중지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
    }

    const audio = new Audio(`file://${audioPath}`);
    currentAudioRef.current = audio;
    setIsPlayingTTS(true);

    audio.addEventListener('ended', () => {
      if (currentAudioRef.current === audio) {
        setIsPlayingTTS(false);
        currentAudioRef.current = null;
      }
    });
    audio.addEventListener('error', () => {
      if (currentAudioRef.current === audio) {
        setIsPlayingTTS(false);
        currentAudioRef.current = null;
      }
    });

    audio.play().catch((err) => {
      console.error('TTS 재생 실패:', err);
      if (currentAudioRef.current === audio) {
        setIsPlayingTTS(false);
        currentAudioRef.current = null;
      }
    });
  }, []);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
      }
    };
  }, []);

  const startConversation = useCallback(
    async (topicId: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await window.electron.invoke('start-conversation', {
          topicId,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error || '대화 시작에 실패했습니다.');
        }

        const result = response.data as ConversationStartResult;

        // 대화 세션 설정
        const newConversation: Conversation = {
          id: result.conversationId,
          topicId,
          sessionId: null,
          startedAt: new Date(),
          endedAt: null,
          duration: null,
          messageCount: 1,
          createdAt: new Date(),
        };

        // AI 첫 메시지 추가
        const firstMessage: Message = {
          id: result.firstMessage.id,
          conversationId: result.conversationId,
          speaker: 'ai',
          content: result.firstMessage.content,
          audioPath: result.firstMessage.ttsPath,
          timestamp: result.firstMessage.timestamp,
          createdAt: new Date(),
        };

        setConversation(newConversation);
        setMessages([firstMessage]);

        // TTS 자동 재생 (안전한 오디오 재생, 마운트 상태 확인)
        if (result.firstMessage.ttsPath && isMountedRef.current) {
          playAudioSafely(result.firstMessage.ttsPath);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '대화 시작 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [playAudioSafely]
  );

  const sendMessage = useCallback(
    async (content: string, timestamp: number) => {
      if (!conversation) {
        setError('대화 세션이 없습니다.');
        return;
      }

      // 낙관적 UI 업데이트 - 사용자 메시지 즉시 표시
      const tempUserMessage: Message = {
        id: -1,
        conversationId: conversation.id,
        speaker: 'user',
        content,
        audioPath: null,
        timestamp,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, tempUserMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await window.electron.invoke('send-user-message', {
          conversationId: conversation.id,
          content,
          timestamp,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error || 'AI 응답 생성에 실패했습니다.');
        }

        const result = response.data as MessageExchangeResult;

        // 실제 사용자 메시지 ID로 업데이트 + AI 응답 추가
        const userMessage: Message = {
          ...tempUserMessage,
          id: result.userMessageId,
        };

        const aiMessage: Message = {
          id: result.aiMessage.id,
          conversationId: conversation.id,
          speaker: 'ai',
          content: result.aiMessage.content,
          audioPath: result.aiMessage.ttsPath,
          timestamp: result.aiMessage.timestamp,
          createdAt: new Date(),
        };

        setMessages((prev) => {
          // 임시 메시지 제거하고 실제 메시지들 추가
          const withoutTemp = prev.filter((m) => m.id !== -1);
          return [...withoutTemp, userMessage, aiMessage];
        });

        // TTS 자동 재생 (안전한 오디오 재생, 마운트 상태 확인)
        if (result.aiMessage.ttsPath && isMountedRef.current) {
          playAudioSafely(result.aiMessage.ttsPath);
        }
      } catch (err) {
        // 에러 발생 시 임시 메시지 제거
        setMessages((prev) => prev.filter((m) => m.id !== -1));
        setError(err instanceof Error ? err.message : '메시지 전송 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, playAudioSafely]
  );

  const endConversation = useCallback(async () => {
    if (!conversation) {
      setError('대화 세션이 없습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electron.invoke('end-conversation', {
        conversationId: conversation.id,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || '대화 종료에 실패했습니다.');
      }

      const result = response.data as ConversationEndResult;

      // 대화 종료 정보 업데이트
      setConversation((prev: Conversation | null) =>
        prev
          ? {
              ...prev,
              endedAt: new Date(),
              duration: result.totalDuration,
              messageCount: result.messageCount,
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '대화 종료 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  /**
   * FR-002: TTS 다시 듣기 (중복 재생 방지)
   */
  const replayTTS = useCallback(
    async (messageId: number) => {
      // 항상 기존 오디오 중지 (단계 6과 동일한 패턴)
      stopCurrentAudio();

      try {
        const response = await window.electron.invoke('replay-tts', {
          messageId,
        });

        if (!response.success || !response.data?.ttsPath) {
          throw new Error(response.error || 'TTS 파일을 찾을 수 없습니다.');
        }

        playAudioSafely(response.data.ttsPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TTS 재생 중 오류가 발생했습니다.');
        setIsPlayingTTS(false);
      }
    },
    [stopCurrentAudio, playAudioSafely]
  );

  return {
    conversation,
    messages,
    isLoading,
    isPlayingTTS,
    error,
    startConversation,
    sendMessage,
    endConversation,
    replayTTS,
    clearError,
  };
};

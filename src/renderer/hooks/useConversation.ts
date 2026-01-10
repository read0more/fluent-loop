import { useState, useCallback } from 'react';
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startConversation = useCallback(async (topicId: number) => {
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

      // TTS 자동 재생
      if (result.firstMessage.ttsPath) {
        const audio = new Audio(`file://${result.firstMessage.ttsPath}`);
        audio.play().catch((err) => {
          console.error('TTS 자동 재생 실패:', err);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '대화 시작 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

        // TTS 자동 재생
        if (result.aiMessage.ttsPath) {
          const audio = new Audio(`file://${result.aiMessage.ttsPath}`);
          audio.play().catch((err) => {
            console.error('TTS 자동 재생 실패:', err);
          });
        }
      } catch (err) {
        // 에러 발생 시 임시 메시지 제거
        setMessages((prev) => prev.filter((m) => m.id !== -1));
        setError(err instanceof Error ? err.message : '메시지 전송 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [conversation]
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
  const replayTTS = useCallback(async (messageId: number) => {
    // 중복 재생 방지
    if (isPlayingTTS) {
      console.log('TTS already playing');
      return;
    }

    try {
      setIsPlayingTTS(true);

      const response = await window.electron.invoke('replay-tts', {
        messageId,
      });

      if (!response.success || !response.data?.ttsPath) {
        throw new Error(response.error || 'TTS 파일을 찾을 수 없습니다.');
      }

      const audio = new Audio(`file://${response.data.ttsPath}`);

      // 재생 완료 시 상태 해제
      audio.addEventListener('ended', () => {
        setIsPlayingTTS(false);
      });

      // 에러 발생 시에도 상태 해제
      audio.addEventListener('error', () => {
        setIsPlayingTTS(false);
      });

      await audio.play().catch((err) => {
        console.error('TTS 재생 실패:', err);
        setError('음성 재생에 실패했습니다.');
        setIsPlayingTTS(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TTS 재생 중 오류가 발생했습니다.');
      setIsPlayingTTS(false);
    }
  }, [isPlayingTTS]);

  return {
    conversation,
    messages,
    isLoading,
    error,
    startConversation,
    sendMessage,
    endConversation,
    replayTTS,
    clearError,
  };
};

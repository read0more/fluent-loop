import React from 'react';
import { Message } from '../../../main/database/models';
import { ChatMessage } from './ChatMessage';
import { useChatScroll } from '../../hooks/useChatScroll';
import { LoadingSpinner } from '../LoadingSpinner';

export interface ChatContainerProps {
  messages: Message[];
  isAIResponding: boolean;
  onReplayTTS: (messageId: number) => void;
}

/**
 * 채팅 메시지 목록 컨테이너
 * 자동 스크롤 및 로딩 상태 표시
 */
export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isAIResponding,
  onReplayTTS,
}) => {
  const { containerRef } = useChatScroll([messages]);

  return (
    <div className="chat-container" ref={containerRef}>
      {messages.length === 0 && !isAIResponding && (
        <div className="chat-empty-state">
          <p>대화를 시작하세요!</p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onReplayTTS={
            message.speaker === 'ai' ? () => onReplayTTS(message.id) : undefined
          }
        />
      ))}

      {isAIResponding && (
        <div className="ai-responding-indicator">
          <LoadingSpinner message="AI 응답 생성 중..." size="small" />
        </div>
      )}
    </div>
  );
};

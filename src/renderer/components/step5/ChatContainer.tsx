import React from 'react';
import { Message } from '../../../main/database/models';
import { ChatMessage } from './ChatMessage';
import { useChatScroll } from '../../hooks/useChatScroll';
import { LoadingSpinner } from '../LoadingSpinner';
import styles from './ChatContainer.module.scss';

export interface ChatContainerProps {
  messages: Message[];
  isAIResponding?: boolean;  // optional (default: false)
  onReplayTTS?: (messageId: number) => void;  // optional
}

/**
 * 채팅 메시지 목록 컨테이너
 * 자동 스크롤 및 로딩 상태 표시
 * Step 5 (대화) 및 Step 6 (첨삭 모달)에서 재사용
 */
export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isAIResponding = false,
  onReplayTTS,
}) => {
  const { containerRef } = useChatScroll([messages]);

  return (
    <div className={styles.container} ref={containerRef}>
      {messages.length === 0 && !isAIResponding && (
        <div className={styles.emptyState}>
          <p>대화를 시작하세요!</p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onReplayTTS={
            message.speaker === 'ai' && onReplayTTS ? () => onReplayTTS(message.id) : undefined
          }
        />
      ))}

      {isAIResponding && (
        <div className={styles.respondingIndicator}>
          <LoadingSpinner message="AI 응답 생성 중..." size="small" />
        </div>
      )}
    </div>
  );
};

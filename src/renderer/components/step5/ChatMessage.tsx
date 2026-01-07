import React from 'react';
import { Message } from '../../../main/database/models';

export interface ChatMessageProps {
  message: Message;
  onReplayTTS?: () => void;
}

/**
 * 개별 채팅 메시지 표시
 * AI/사용자 구분 스타일링
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onReplayTTS,
}) => {
  const isAI = message.speaker === 'ai';
  const messageClass = `chat-message ${isAI ? 'ai-message' : 'user-message'}`;

  const formatTimestamp = (timestamp: number): string => {
    const mins = Math.floor(timestamp / 60);
    const secs = timestamp % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={messageClass}>
      <div className="message-avatar">
        {isAI ? (
          <span className="avatar-icon ai-avatar">🤖</span>
        ) : (
          <span className="avatar-icon user-avatar">👤</span>
        )}
      </div>

      <div className="message-content-wrapper">
        <div className="message-bubble">
          <p className="message-text">{message.content}</p>

          {isAI && message.audioPath && onReplayTTS && (
            <button
              className="replay-tts-button"
              onClick={onReplayTTS}
              title="다시 듣기"
            >
              <span className="speaker-icon">🔊</span>
              다시 듣기
            </button>
          )}
        </div>

        <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
};

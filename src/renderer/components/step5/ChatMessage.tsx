import React from 'react';
import { Message } from '../../../main/database/models';
import styles from './ChatMessage.module.scss';

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
  const messageClass = `${styles.message} ${isAI ? styles.ai : styles.user}`;

  const formatTimestamp = (timestamp: number): string => {
    const mins = Math.floor(timestamp / 60);
    const secs = timestamp % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={messageClass}>
      <div className={styles.avatar}>
        {isAI ? (
          <span className={`${styles.avatarIcon} ${styles.ai}`}>🤖</span>
        ) : (
          <span className={`${styles.avatarIcon} ${styles.user}`}>👤</span>
        )}
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.bubble}>
          <p className={styles.text}>{message.content}</p>

          {isAI && message.audioPath && onReplayTTS && (
            <button
              className={styles.replayButton}
              onClick={onReplayTTS}
              title="다시 듣기"
            >
              <span className={styles.speakerIcon}>🔊</span>
              다시 듣기
            </button>
          )}
        </div>

        <span className={styles.timestamp}>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
};

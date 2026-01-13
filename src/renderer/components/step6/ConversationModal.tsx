import React from 'react';
import { Message } from '../../../main/database/models';
import { ChatContainer } from '../step5/ChatContainer';
import styles from './ConversationModal.module.scss';

interface ConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

/**
 * 대화 내용 모달
 * Step 6에서 Step 5의 원본 대화를 확인할 수 있는 모달
 */
export const ConversationModal: React.FC<ConversationModalProps> = ({
  isOpen,
  onClose,
  messages,
}) => {
  if (!isOpen) return null;

  // Overlay 클릭 시 모달 닫기 (내부 클릭은 제외)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>대화 내용</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {messages.length === 0 ? (
            <div className={styles.emptyMessage}>
              <p>표시할 대화 내용이 없습니다.</p>
            </div>
          ) : (
            <ChatContainer messages={messages} />
          )}
        </div>
        <div className={styles.footer}>
          <button onClick={onClose} className="btn-secondary">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

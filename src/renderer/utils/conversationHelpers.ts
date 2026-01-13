import { ConversationCorrectionResult, Message } from '../../main/database/models';

/**
 * ConversationCorrectionResult를 Message로 변환
 * 모달에서 ChatContainer를 사용하기 위한 유틸 함수
 *
 * @param correction 첨삭 결과
 * @returns Message 객체 (ChatContainer에서 사용)
 */
export function correctionToMessage(correction: ConversationCorrectionResult): Message {
  return {
    id: correction.messageId,
    conversationId: 0, // 모달에서는 불필요
    speaker: correction.speaker,
    content: correction.original, // 원문 표시 (첨삭 전)
    audioPath: null,
    timestamp: correction.timestamp,
    createdAt: new Date(), // 임시값
  };
}

/**
 * 첨삭 결과 배열을 Message 배열로 변환
 *
 * @param corrections 첨삭 결과 배열
 * @returns Message 배열
 */
export function correctionsToMessages(corrections: ConversationCorrectionResult[]): Message[] {
  return corrections.map(correctionToMessage);
}

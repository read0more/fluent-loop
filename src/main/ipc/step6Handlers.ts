import { ipcMain } from 'electron';
import { ClaudeService } from '../services/ClaudeService';
import { CorrectionService } from '../services/CorrectionService';
import { AppError, ErrorCode } from '../errors/AppError';
import {
  IPCResponse,
  ConversationCorrectionResult,
  CorrectConversationRequest,
  SaveConversationCorrectionsRequest,
} from '../database/models';

// Service instances
let claudeService: ClaudeService;
let correctionService: CorrectionService;

export function registerStep6Handlers(): void {
  // Service initialization (lazy loading to ensure DB is ready)
  claudeService = new ClaudeService();
  correctionService = new CorrectionService();

  /**
   * TC-S6-015: 대화 전체 첨삭
   */
  ipcMain.handle(
    'correct-conversation',
    async (event, { conversationId }: CorrectConversationRequest) => {
      const response: IPCResponse<ConversationCorrectionResult[]> = {
        success: false,
      };

      try {
        // Validation
        if (!conversationId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing conversationId',
            '대화 ID가 필요합니다.'
          );
        }

        if (typeof conversationId !== 'number' || conversationId <= 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid conversationId',
            '유효하지 않은 대화 ID입니다.'
          );
        }

        // 대화 전체 첨삭
        const results = await claudeService.correctConversation(conversationId);

        response.success = true;
        response.data = results;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(
            `[ConversationCorrectionError] ${error.code}: ${error.message}`,
            error.originalError
          );
        } else {
          response.error = '대화 첨삭 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * TC-S6-016: 대화 첨삭 결과 저장
   */
  ipcMain.handle(
    'save-conversation-corrections',
    async (
      event,
      { conversationId, corrections, sessionId, topicId }: SaveConversationCorrectionsRequest
    ) => {
      const response: IPCResponse<void> = {
        success: false,
      };

      try {
        // Validation
        if (!conversationId || !topicId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing required parameters',
            '필수 파라미터가 누락되었습니다.'
          );
        }

        if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid corrections array',
            '저장할 첨삭 결과가 없습니다.'
          );
        }

        // user 메시지만 필터링
        const userCorrections = corrections.filter((c) => c.speaker === 'user');

        if (userCorrections.length === 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'No user corrections to save',
            '저장할 사용자 메시지가 없습니다.'
          );
        }

        // CorrectionResult 형식으로 변환
        const correctionsToSave = userCorrections.map((c) => ({
          original: c.original,
          corrected: c.corrected,
          explanation: c.explanation,
          categories: c.categories,
        }));

        // sessionId가 없으면 0을 사용 (CorrectionService에서 null로 저장됨)
        await correctionService.saveCorrections(correctionsToSave, sessionId || 0, topicId);

        response.success = true;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(
            `[SaveConversationCorrectionsError] ${error.code}: ${error.message}`,
            error.originalError
          );
        } else {
          response.error = '저장 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * TC-S6-017: 대화 정보 조회 (선택적)
   */
  ipcMain.handle('get-conversation-for-correction', async (event, { conversationId }) => {
    const response: IPCResponse<unknown> = {
      success: false,
    };

    try {
      // Validation
      if (!conversationId) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Missing conversationId',
          '대화 ID가 필요합니다.'
        );
      }

      // Note: 이 핸들러는 필요시 ConversationService를 통해 구현 가능
      // 현재는 placeholder로 남겨둠
      throw new AppError(
        ErrorCode.NOT_IMPLEMENTED,
        'Not implemented yet',
        '아직 구현되지 않았습니다.'
      );
    } catch (error) {
      if (error instanceof AppError) {
        response.error = error.userMessage;
        response.errorCode = error.code;
      } else {
        response.error = '대화 정보 조회에 실패했습니다.';
        response.errorCode = ErrorCode.UNKNOWN_ERROR;
      }
    }

    return response;
  });
}

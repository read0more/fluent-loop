import { ipcMain } from 'electron';
import { CorrectionService } from '../services/CorrectionService';
import { AppError, ErrorCode } from '../errors/AppError';
import {
  IPCResponse,
  CorrectionResult,
  CorrectSentenceRequest,
  CorrectSentencesBatchRequest,
  SaveCorrectionRequest,
} from '../database/models';

// Service instance - initialized in registerStep4Handlers
let correctionService: CorrectionService;

export function registerStep4Handlers(): void {
  // Service initialization (lazy loading to ensure DB is ready)
  correctionService = new CorrectionService();
  /**
   * TC-012: 단일 문장 첨삭
   */
  ipcMain.handle(
    'correct-sentence',
    async (event, { sentence, cefrLevel }: CorrectSentenceRequest) => {
      const response: IPCResponse<CorrectionResult> = {
        success: false,
      };

      try {
        // Validation
        if (!sentence || !cefrLevel) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing required parameters',
            '문장과 CEFR 레벨을 입력해주세요.'
          );
        }

        if (sentence.trim().length === 0) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Empty sentence', '문장을 입력해주세요.');
        }

        if (sentence.length > 500) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Sentence too long',
            '문장이 너무 깁니다. (최대 500자)'
          );
        }

        const result = await correctionService.correctSentence(sentence, cefrLevel);

        response.success = true;
        response.data = result;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(`[CorrectionError] ${error.code}: ${error.message}`, error.originalError);
        } else {
          response.error = '첨삭 처리 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * 배치 첨삭: 여러 문장을 한 번에 처리 (성능 최적화)
   */
  ipcMain.handle(
    'correct-sentences-batch',
    async (event, { sentences, cefrLevel }: CorrectSentencesBatchRequest) => {
      const response: IPCResponse<CorrectionResult[]> = {
        success: false,
      };

      try {
        // Validation
        if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Empty sentences array',
            '첨삭할 문장이 없습니다.'
          );
        }

        if (!cefrLevel) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing CEFR level',
            'CEFR 레벨을 입력해주세요.'
          );
        }

        // 개별 문장 검증
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          if (!sentence || sentence.trim().length === 0) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `Empty sentence at index ${i}`,
              `문장 ${i + 1}이 비어있습니다.`
            );
          }
          if (sentence.length > 500) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              `Sentence too long at index ${i}`,
              `문장 ${i + 1}이 너무 깁니다. (최대 500자)`
            );
          }
        }

        const results = await correctionService.correctSentencesBatch(sentences, cefrLevel);

        response.success = true;
        response.data = results;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(
            `[BatchCorrectionError] ${error.code}: ${error.message}`,
            error.originalError
          );
        } else {
          response.error = '배치 첨삭 처리 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * TC-013: 첨삭 결과 저장
   */
  ipcMain.handle(
    'save-correction',
    async (event, { corrections, sessionId, topicId }: SaveCorrectionRequest) => {
      const response: IPCResponse<void> = {
        success: false,
      };

      try {
        // Validation
        if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid corrections array',
            '저장할 첨삭 결과가 없습니다.'
          );
        }

        if (!sessionId || !topicId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing sessionId or topicId',
            '세션 정보가 올바르지 않습니다.'
          );
        }

        await correctionService.saveCorrections(corrections, sessionId, topicId);

        response.success = true;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(
            `[SaveCorrectionError] ${error.code}: ${error.message}`,
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
}

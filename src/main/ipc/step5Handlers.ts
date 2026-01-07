import { ipcMain } from 'electron';
import { ConversationService } from '../services/ConversationService';
import { AppError, ErrorCode } from '../errors/AppError';
import {
  IPCResponse,
  ConversationStartResult,
  MessageExchangeResult,
  ConversationEndResult,
  Message,
  StartConversationRequest,
  SendUserMessageRequest,
  EndConversationRequest,
  GetConversationHistoryRequest,
  ReplayTTSRequest,
} from '../database/models';

// Service instance
let conversationService: ConversationService;

export function registerStep5Handlers(): void {
  // Service initialization
  conversationService = new ConversationService();

  /**
   * 대화 시작
   */
  ipcMain.handle('start-conversation', async (event, { topicId }: StartConversationRequest) => {
    const response: IPCResponse<ConversationStartResult> = {
      success: false,
    };

    try {
      // Validation
      if (!topicId) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Missing topicId',
          '토픽 ID가 필요합니다.'
        );
      }

      const result = await conversationService.startConversation(topicId);

      response.success = true;
      response.data = result;
    } catch (error) {
      if (error instanceof AppError) {
        response.error = error.userMessage;
        response.errorCode = error.code;
        console.error(`[ConversationError] ${error.code}: ${error.message}`, error.originalError);
      } else {
        response.error = '대화 시작 중 오류가 발생했습니다.';
        response.errorCode = ErrorCode.UNKNOWN_ERROR;
        console.error('[UnknownError]', error);
      }
    }

    return response;
  });

  /**
   * 사용자 메시지 전송
   */
  ipcMain.handle(
    'send-user-message',
    async (event, { conversationId, content, timestamp }: SendUserMessageRequest) => {
      const response: IPCResponse<MessageExchangeResult> = {
        success: false,
      };

      try {
        // Validation
        if (!conversationId || !content) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Missing required parameters',
            '대화 ID와 메시지 내용이 필요합니다.'
          );
        }

        if (timestamp === undefined || timestamp < 0) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            'Invalid timestamp',
            '타임스탬프가 올바르지 않습니다.'
          );
        }

        const result = await conversationService.sendMessage(conversationId, content, timestamp);

        response.success = true;
        response.data = result;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(`[SendMessageError] ${error.code}: ${error.message}`, error.originalError);
        } else {
          response.error = '메시지 전송 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * 대화 종료
   */
  ipcMain.handle(
    'end-conversation',
    async (event, { conversationId }: EndConversationRequest) => {
      const response: IPCResponse<ConversationEndResult> = {
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

        const result = await conversationService.endConversation(conversationId);

        response.success = true;
        response.data = result;
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(`[EndConversationError] ${error.code}: ${error.message}`, error.originalError);
        } else {
          response.error = '대화 종료 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * 대화 히스토리 조회
   */
  ipcMain.handle(
    'get-conversation-history',
    async (event, { conversationId }: GetConversationHistoryRequest) => {
      const response: IPCResponse<{ messages: Message[] }> = {
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

        const messages = await conversationService.getConversationHistory(conversationId);

        response.success = true;
        response.data = { messages };
      } catch (error) {
        if (error instanceof AppError) {
          response.error = error.userMessage;
          response.errorCode = error.code;
          console.error(`[GetHistoryError] ${error.code}: ${error.message}`, error.originalError);
        } else {
          response.error = '대화 히스토리 조회 중 오류가 발생했습니다.';
          response.errorCode = ErrorCode.UNKNOWN_ERROR;
          console.error('[UnknownError]', error);
        }
      }

      return response;
    }
  );

  /**
   * TTS 재생
   */
  ipcMain.handle('replay-tts', async (event, { messageId }: ReplayTTSRequest) => {
    const response: IPCResponse<{ ttsPath: string }> = {
      success: false,
    };

    try {
      // Validation
      if (!messageId) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Missing messageId',
          '메시지 ID가 필요합니다.'
        );
      }

      const ttsPath = await conversationService.replayTTS(messageId);

      response.success = true;
      response.data = { ttsPath };
    } catch (error) {
      if (error instanceof AppError) {
        response.error = error.userMessage;
        response.errorCode = error.code;
        console.error(`[ReplayTTSError] ${error.code}: ${error.message}`, error.originalError);
      } else {
        response.error = 'TTS 재생 중 오류가 발생했습니다.';
        response.errorCode = ErrorCode.UNKNOWN_ERROR;
        console.error('[UnknownError]', error);
      }
    }

    return response;
  });
}

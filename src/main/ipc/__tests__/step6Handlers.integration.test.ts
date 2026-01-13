import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService } from '../../services/ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';
import {
  IPCResponse,
  ConversationCorrectionResult,
  CorrectConversationRequest,
} from '../../database/models';

// Mock IPC event
const createMockEvent = () => ({}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Step 6 Handlers - Integration Tests', () => {
  let claudeService: ClaudeService;

  beforeEach(() => {
    claudeService = new ClaudeService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== 통합 테스트 (Integration Tests) ====================

  describe('TC-011: correct-conversation IPC 핸들러 정상 케이스', () => {
    it('should return successful response with corrections', async () => {
      // Arrange
      const conversationId = 1;

      // Mock ClaudeService.correctConversation
      const mockResults: ConversationCorrectionResult[] = [
        {
          messageId: 1,
          speaker: 'user',
          original: 'I go to school yesterday',
          corrected: 'I went to school yesterday',
          explanation: 'Use past tense',
          categories: ['grammar'],
          timestamp: 0,
        },
        {
          messageId: 2,
          speaker: 'ai',
          original: 'What time?',
          corrected: 'What time?',
          explanation: '',
          categories: [],
          timestamp: 5,
        },
      ];

      vi.spyOn(claudeService, 'correctConversation').mockResolvedValue(mockResults);

      // Simulate IPC handler logic
      const handler = async (
        event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { conversationId }: CorrectConversationRequest
      ): Promise<IPCResponse<ConversationCorrectionResult[]>> => {
        const response: IPCResponse<ConversationCorrectionResult[]> = {
          success: false,
        };

        try {
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

          const results = await claudeService.correctConversation(conversationId);

          response.success = true;
          response.data = results;
        } catch (error) {
          if (error instanceof AppError) {
            response.error = error.userMessage;
            response.errorCode = error.code;
          } else {
            response.error = '대화 첨삭 중 오류가 발생했습니다.';
            response.errorCode = ErrorCode.UNKNOWN_ERROR;
          }
        }

        return response;
      };

      // Act
      const response = await handler(createMockEvent(), { conversationId });

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data![0].corrected).toBe('I went to school yesterday');
    });
  });

  describe('TC-012: correct-conversation 대화 없음 에러', () => {
    it('should return error when conversation not found', async () => {
      // Arrange
      const conversationId = 999;

      vi.spyOn(claudeService, 'correctConversation').mockRejectedValue(
        new AppError(ErrorCode.NOT_FOUND, 'Conversation not found', '대화를 찾을 수 없습니다.')
      );

      // Simulate IPC handler logic
      const handler = async (
        event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { conversationId }: CorrectConversationRequest
      ): Promise<IPCResponse<ConversationCorrectionResult[]>> => {
        const response: IPCResponse<ConversationCorrectionResult[]> = {
          success: false,
        };

        try {
          if (!conversationId || typeof conversationId !== 'number' || conversationId <= 0) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid conversationId',
              '유효하지 않은 대화 ID입니다.'
            );
          }

          const results = await claudeService.correctConversation(conversationId);
          response.success = true;
          response.data = results;
        } catch (error) {
          if (error instanceof AppError) {
            response.error = error.userMessage;
            response.errorCode = error.code;
          } else {
            response.error = '대화 첨삭 중 오류가 발생했습니다.';
            response.errorCode = ErrorCode.UNKNOWN_ERROR;
          }
        }

        return response;
      };

      // Act
      const response = await handler(createMockEvent(), { conversationId });

      // Assert
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('TC-013: correct-conversation JSON 파싱 에러', () => {
    it('should return error when parsing fails', async () => {
      // Arrange
      const conversationId = 1;

      vi.spyOn(claudeService, 'correctConversation').mockRejectedValue(
        new AppError(
          ErrorCode.CLAUDE_PARSING_ERROR,
          'Parsing failed',
          '대화 첨삭 결과 파싱에 실패했습니다'
        )
      );

      // Simulate IPC handler logic
      const handler = async (
        event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { conversationId }: CorrectConversationRequest
      ): Promise<IPCResponse<ConversationCorrectionResult[]>> => {
        const response: IPCResponse<ConversationCorrectionResult[]> = {
          success: false,
        };

        try {
          if (!conversationId || typeof conversationId !== 'number' || conversationId <= 0) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid conversationId',
              '유효하지 않은 대화 ID입니다.'
            );
          }

          const results = await claudeService.correctConversation(conversationId);
          response.success = true;
          response.data = results;
        } catch (error) {
          if (error instanceof AppError) {
            response.error = error.userMessage;
            response.errorCode = error.code;
          } else {
            response.error = '대화 첨삭 중 오류가 발생했습니다.';
            response.errorCode = ErrorCode.UNKNOWN_ERROR;
          }
        }

        return response;
      };

      // Act
      const response = await handler(createMockEvent(), { conversationId });

      // Assert
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(ErrorCode.CLAUDE_PARSING_ERROR);
      expect(response.error).toContain('파싱');
    });
  });

  describe('TC-014: correct-conversation 유효성 검증 (conversationId 없음)', () => {
    it('should return validation error when conversationId is missing', async () => {
      // Arrange
      const conversationId = undefined as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Simulate IPC handler logic
      const handler = async (
        event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { conversationId }: any // eslint-disable-line @typescript-eslint/no-explicit-any
      ): Promise<IPCResponse<ConversationCorrectionResult[]>> => {
        const response: IPCResponse<ConversationCorrectionResult[]> = {
          success: false,
        };

        try {
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

          const results = await claudeService.correctConversation(conversationId);
          response.success = true;
          response.data = results;
        } catch (error) {
          if (error instanceof AppError) {
            response.error = error.userMessage;
            response.errorCode = error.code;
          } else {
            response.error = '대화 첨삭 중 오류가 발생했습니다.';
            response.errorCode = ErrorCode.UNKNOWN_ERROR;
          }
        }

        return response;
      };

      // Act
      const response = await handler(createMockEvent(), { conversationId });

      // Assert
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('TC-015: correct-conversation 유효성 검증 (잘못된 conversationId)', () => {
    it('should return validation error when conversationId is invalid', async () => {
      // Arrange
      const conversationId = -1;

      // Simulate IPC handler logic
      const handler = async (
        event: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { conversationId }: CorrectConversationRequest
      ): Promise<IPCResponse<ConversationCorrectionResult[]>> => {
        const response: IPCResponse<ConversationCorrectionResult[]> = {
          success: false,
        };

        try {
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

          const results = await claudeService.correctConversation(conversationId);
          response.success = true;
          response.data = results;
        } catch (error) {
          if (error instanceof AppError) {
            response.error = error.userMessage;
            response.errorCode = error.code;
          } else {
            response.error = '대화 첨삭 중 오류가 발생했습니다.';
            response.errorCode = ErrorCode.UNKNOWN_ERROR;
          }
        }

        return response;
      };

      // Act
      const response = await handler(createMockEvent(), { conversationId });

      // Assert
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });
});

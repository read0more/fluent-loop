/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import type { TopicContext, ConversationMessage } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';

/**
 * ClaudeService Conversation Tests (Updated for Claude Agent SDK)
 *
 * 이전 CLI 기반 구현에서 Claude Agent SDK로 마이그레이션됨
 * - executeClaude() → client.query()
 * - parseConversationResponse() 제거 (SDK가 직접 텍스트 반환)
 */

// Mock functions - hoisted to module level for access in vi.mock
const mockQuery = vi.fn();
const mockQueryStructured = vi.fn();

// Mock ClaudeSDKClient as a constructor function
vi.mock('../ClaudeSDKClient', () => {
  return {
    ClaudeSDKClient: vi.fn().mockImplementation(function (this: any) {
      this.query = mockQuery;
      this.queryStructured = mockQueryStructured;
      return this;
    }),
  };
});

describe('ClaudeService - AI Conversation Response (SDK Migration)', () => {
  let service: ClaudeService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQueryStructured.mockReset();
    service = new ClaudeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. SDK 기반 대화 응답 테스트
  // ==========================================

  describe('1.1 generateConversationResponse - SDK Integration', () => {
    // TC-001: SDK가 직접 텍스트 반환 (no wrapper parsing needed)
    it('TC-001: SDK가 직접 텍스트 반환', async () => {
      mockQuery.mockResolvedValue('Hello! How are you today?');

      const topicContext: TopicContext = {
        englishContent: 'Talking about hobbies',
        cefrLevel: 'B1',
        keywords: ['hobby'],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('Hello! How are you today?');
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    // TC-002: 첫 메시지 생성
    it('TC-002: 첫 메시지 생성', async () => {
      mockQuery.mockResolvedValue('What do you like to do in your free time?');

      const topicContext: TopicContext = {
        englishContent: 'Talking about hobbies',
        cefrLevel: 'B1',
        keywords: ['hobby', 'free time'],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('What do you like to do in your free time?');
    });

    // TC-003: 후속 메시지 생성
    it('TC-003: 후속 메시지 생성', async () => {
      mockQuery.mockResolvedValue("That's great! What kind of books do you like?");

      const topicContext: TopicContext = {
        englishContent: 'Hobbies',
        cefrLevel: 'B1',
        keywords: ['hobby'],
      };

      const history: ConversationMessage[] = [
        { speaker: 'ai', content: 'What do you like?' },
        { speaker: 'user', content: 'I like reading.' },
      ];

      const response = await service.generateConversationResponse(topicContext, history, false);

      expect(response).toBe("That's great! What kind of books do you like?");
    });

    // TC-004: SDK 에러 시 AppError로 변환
    it('TC-004: SDK 에러 시 AppError로 변환', async () => {
      mockQuery.mockRejectedValue(new Error('SDK connection failed'));

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      await expect(service.generateConversationResponse(topicContext, [], true)).rejects.toThrow(
        AppError
      );

      try {
        await service.generateConversationResponse(topicContext, [], true);
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCode.CLAUDE_API_ERROR);
        expect((error as AppError).userMessage).toContain('AI 응답 생성에 실패했습니다');
      }
    });

    // TC-005: Validation 실패 - englishContent 누락
    it('TC-005: Validation 실패 - englishContent 누락', async () => {
      const topicContext: TopicContext = {
        englishContent: '',
        cefrLevel: 'B1',
        keywords: [],
      };

      await expect(service.generateConversationResponse(topicContext, [], true)).rejects.toThrow(
        AppError
      );

      try {
        await service.generateConversationResponse(topicContext, [], true);
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
        expect((error as AppError).userMessage).toContain('토픽 정보가 필요합니다');
      }
    });

    // TC-006: Validation 실패 - cefrLevel 누락
    it('TC-006: Validation 실패 - cefrLevel 누락', async () => {
      const topicContext: any = {
        englishContent: 'Test',
        keywords: [],
      };

      await expect(service.generateConversationResponse(topicContext, [], true)).rejects.toThrow(
        AppError
      );
    });
  });

  // ==========================================
  // 2. 여러 대화 턴 테스트
  // ==========================================

  describe('2.1 Multi-turn Conversation Tests', () => {
    // TC-007: 여러 대화 턴 시뮬레이션
    it('TC-007: 여러 대화 턴 시뮬레이션', async () => {
      let callCount = 0;
      mockQuery.mockImplementation(() => {
        const responses = ['First message', 'Second message', 'Third message'];
        return Promise.resolve(responses[callCount++]);
      });

      const topicContext: TopicContext = {
        englishContent: 'Hobbies',
        cefrLevel: 'B1',
        keywords: ['hobby'],
      };

      const history: ConversationMessage[] = [];

      // Turn 1
      const response1 = await service.generateConversationResponse(topicContext, history, true);
      expect(response1).toBe('First message');
      history.push({ speaker: 'ai', content: response1 });
      history.push({ speaker: 'user', content: 'User reply 1' });

      // Turn 2
      const response2 = await service.generateConversationResponse(topicContext, history, false);
      expect(response2).toBe('Second message');
      history.push({ speaker: 'ai', content: response2 });
      history.push({ speaker: 'user', content: 'User reply 2' });

      // Turn 3
      const response3 = await service.generateConversationResponse(topicContext, history, false);
      expect(response3).toBe('Third message');

      expect(history.length).toBe(4); // 2 AI + 2 User
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    // TC-008: 빈 응답 처리
    it('TC-008: 빈 응답 처리', async () => {
      mockQuery.mockResolvedValue('');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('');
      expect(response.length).toBe(0);
    });
  });

  // ==========================================
  // 3. 다국어 및 특수 문자 테스트
  // ==========================================

  describe('3. Special Characters and Unicode Tests', () => {
    // TC-009: UTF-8 다국어 텍스트
    it('TC-009: UTF-8 다국어 텍스트', async () => {
      mockQuery.mockResolvedValue('안녕하세요! こんにちは! 你好!');

      const topicContext: TopicContext = {
        englishContent: 'Greetings',
        cefrLevel: 'A1',
        keywords: ['hello'],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('안녕하세요! こんにちは! 你好!');
    });

    // TC-010: 특수 문자 포함 응답
    it('TC-010: 특수 문자 포함 응답', async () => {
      mockQuery.mockResolvedValue('Hello!\n"How are you?" 😊');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toContain('\n');
      expect(response).toContain('"');
      expect(response).toContain('😊');
    });

    // TC-011: 매우 긴 응답
    it('TC-011: 매우 긴 응답', async () => {
      const longText = 'A'.repeat(1000);
      mockQuery.mockResolvedValue(longText);

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe(longText);
      expect(response.length).toBe(1000);
    });

    // TC-012: 앞뒤 공백 처리
    it('TC-012: 앞뒤 공백 처리', async () => {
      mockQuery.mockResolvedValue('  Hello with spaces  ');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('Hello with spaces');
    });
  });

  // ==========================================
  // 4. TTS 통합 테스트
  // ==========================================

  describe('4. TTS Integration Tests', () => {
    // TC-013: TTS에서 클린 텍스트 사용
    it('TC-013: TTS에서 클린 텍스트 사용', async () => {
      const mockTTSService = {
        speak: vi.fn(),
      };

      mockQuery.mockResolvedValue('Hello! How are you?');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      // ConversationView에서 TTS 호출 시뮬레이션
      mockTTSService.speak(response);

      expect(mockTTSService.speak).toHaveBeenCalledWith('Hello! How are you?');
      // SDK는 JSON wrapper 없이 직접 텍스트 반환
      expect(mockTTSService.speak).not.toHaveBeenCalledWith(expect.stringContaining('"result"'));
    });
  });

  // ==========================================
  // 5. AppError 전파 테스트
  // ==========================================

  describe('5. AppError Propagation Tests', () => {
    // TC-014: AppError는 그대로 전파
    it('TC-014: AppError는 그대로 전파', async () => {
      const originalError = new AppError(
        ErrorCode.NETWORK_ERROR,
        'Network failed',
        '네트워크 연결을 확인해주세요.'
      );
      mockQuery.mockRejectedValue(originalError);

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      try {
        await service.generateConversationResponse(topicContext, [], true);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });
  });
});

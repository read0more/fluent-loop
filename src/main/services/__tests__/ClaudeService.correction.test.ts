/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';

/**
 * ClaudeService Correction Tests (Updated for Claude Agent SDK)
 *
 * 이전 CLI 기반 구현에서 Claude Agent SDK로 마이그레이션됨
 * - parseCorrectionResponse() 제거 (SDK queryStructured가 직접 파싱된 객체 반환)
 * - buildCorrectionPrompt()은 여전히 private 메서드로 존재
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

// Private 메서드 테스트를 위한 타입 정의
interface ClaudeServiceTestable {
  buildCorrectionPrompt(sentence: string, cefrLevel: string): string;
}

describe('ClaudeService - Correction Features (SDK Migration)', () => {
  let service: ClaudeService;
  let testableService: ClaudeServiceTestable;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQueryStructured.mockReset();
    service = new ClaudeService();
    testableService = service as unknown as ClaudeServiceTestable;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. correctSentence - SDK Integration Tests
  // ==========================================

  describe('TC-001: correctSentence() - SDK 기반 문법 첨삭', () => {
    it('should return structured correction result from SDK', async () => {
      const expectedResult = {
        original: 'I go to school yesterday.',
        corrected: 'I went to school yesterday.',
        explanation: '과거 시제를 사용해야 합니다. go → went',
        categories: ['grammar'],
      };

      mockQueryStructured.mockResolvedValue(expectedResult);

      const result = await service.correctSentence('I go to school yesterday.', 'B1');

      expect(result).toEqual(expectedResult);
      expect(result.original).toBe('I go to school yesterday.');
      expect(result.corrected).toContain('went');
      expect(result.categories).toContain('grammar');
      expect(mockQueryStructured).toHaveBeenCalledOnce();
    });

    it('should correct subject-verb agreement error', async () => {
      const expectedResult = {
        original: "She don't like apples.",
        corrected: "She doesn't like apples.",
        explanation: "3인칭 단수 주어는 doesn't를 사용합니다.",
        categories: ['grammar'],
      };

      mockQueryStructured.mockResolvedValue(expectedResult);

      const result = await service.correctSentence("She don't like apples.", 'A2');

      expect(result.corrected).toContain("doesn't");
      expect(result.categories).toContain('grammar');
    });

    it('should handle correct sentence (no correction needed)', async () => {
      const expectedResult = {
        original: 'I went to school yesterday.',
        corrected: 'I went to school yesterday.',
        explanation: '수정이 필요하지 않습니다.',
        categories: [],
      };

      mockQueryStructured.mockResolvedValue(expectedResult);

      const result = await service.correctSentence('I went to school yesterday.', 'B1');

      expect(result.original).toBe(result.corrected);
      expect(result.categories).toEqual([]);
    });
  });

  // ==========================================
  // 2. Validation Tests
  // ==========================================

  describe('TC-017: Empty string validation', () => {
    it('should throw validation error for empty sentence', async () => {
      await expect(service.correctSentence('', 'B1')).rejects.toThrow(AppError);

      try {
        await service.correctSentence('', 'B1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).userMessage).toContain('문장을 입력해주세요');
      }
    });
  });

  describe('TC-018: Whitespace-only string validation', () => {
    it('should throw validation error for whitespace-only sentence', async () => {
      await expect(service.correctSentence('   ', 'B1')).rejects.toThrow(AppError);
    });
  });

  describe('TC-019: Very long text validation', () => {
    it('should throw validation error for sentence longer than 500 characters', async () => {
      const longSentence = 'A'.repeat(501);

      await expect(service.correctSentence(longSentence, 'B1')).rejects.toThrow(AppError);

      try {
        await service.correctSentence(longSentence, 'B1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).userMessage).toContain('너무 깁니다');
      }
    });
  });

  // ==========================================
  // 3. Special Characters Tests
  // ==========================================

  describe('TC-021: Special characters handling', () => {
    it('should preserve special characters in sentence', async () => {
      const expectedResult = {
        original: "I can't believe it! Really?",
        corrected: "I can't believe it! Really?",
        explanation: '수정이 필요하지 않습니다.',
        categories: [],
      };

      mockQueryStructured.mockResolvedValue(expectedResult);

      const result = await service.correctSentence("I can't believe it! Really?", 'B1');

      expect(result.original).toContain("'");
      expect(result.original).toContain('!');
      expect(result.original).toContain('?');
    });
  });

  // ==========================================
  // 4. Error Handling Tests
  // ==========================================

  describe('TC-022: SDK error handling', () => {
    it('should throw AppError when SDK fails', async () => {
      mockQueryStructured.mockRejectedValue(new Error('SDK error'));

      await expect(service.correctSentence('Test sentence.', 'B1')).rejects.toThrow(AppError);

      try {
        await service.correctSentence('Test sentence.', 'B1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.CLAUDE_API_ERROR);
      }
    });

    it('should propagate AppError as-is', async () => {
      const originalError = new AppError(
        ErrorCode.NETWORK_ERROR,
        'Network failed',
        '네트워크 연결을 확인해주세요.'
      );
      mockQueryStructured.mockRejectedValue(originalError);

      try {
        await service.correctSentence('Test sentence.', 'B1');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });
  });

  // ==========================================
  // 5. buildCorrectionPrompt Tests
  // ==========================================

  describe('buildCorrectionPrompt() - Prompt generation', () => {
    it('should include sentence and CEFR level in prompt', () => {
      const sentence = 'I go to school yesterday.';
      const cefrLevel = 'B1';
      const prompt = testableService.buildCorrectionPrompt(sentence, cefrLevel);

      expect(prompt).toContain(sentence);
      expect(prompt).toContain('B1');
      expect(prompt).toContain('grammar');
      expect(prompt).toContain('vocabulary');
      expect(prompt).toContain('naturalness');
    });

    it('should include level-specific instructions', () => {
      const sentence = 'Test sentence.';
      const promptA1 = testableService.buildCorrectionPrompt(sentence, 'A1');
      const promptC1 = testableService.buildCorrectionPrompt(sentence, 'C1');

      expect(promptA1).toContain('A1');
      expect(promptC1).toContain('C1');
    });

    it('should include JSON response format instructions', () => {
      const prompt = testableService.buildCorrectionPrompt('Test.', 'B1');

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('original');
      expect(prompt).toContain('corrected');
      expect(prompt).toContain('explanation');
      expect(prompt).toContain('categories');
    });
  });
});

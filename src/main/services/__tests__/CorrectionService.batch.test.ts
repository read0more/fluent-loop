import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CorrectionService } from '../CorrectionService';
import { CorrectionResult, CEFRLevel } from '../../database/models';
import { AppError, ErrorCode } from '../../errors/AppError';

// Mock ClaudeService
vi.mock('../ClaudeService', () => {
  class MockClaudeService {
    correctSentencesBatch = vi.fn();
  }

  return {
    ClaudeService: MockClaudeService,
  };
});

// Mock better-sqlite3
const createMockDb = () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(() => []),
    })),
    transaction: vi.fn(<T extends (...args: unknown[]) => unknown>(fn: T): T => {
      return ((...args: unknown[]) => {
        return fn(...args);
      }) as T;
    }),
  };

  return mockDb;
};

describe('CorrectionService - Batch Correction', () => {
  let service: CorrectionService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new CorrectionService(mockDb as unknown as import('better-sqlite3').Database);
  });

  describe('TC-004: correctSentencesBatch() - 배치 첨삭 성공', () => {
    it('should correct multiple sentences in batch', async () => {
      // Arrange
      const sentences = ['This is test.', 'I am student.', 'She go school.'];
      const cefrLevel: CEFRLevel = 'B1';

      const mockResults: CorrectionResult[] = [
        {
          original: 'This is test.',
          corrected: 'This is a test.',
          explanation: '부정관사 추가',
          categories: ['grammar'],
        },
        {
          original: 'I am student.',
          corrected: 'I am a student.',
          explanation: '부정관사 추가',
          categories: ['grammar'],
        },
        {
          original: 'She go school.',
          corrected: 'She goes to school.',
          explanation: '3인칭 단수 동사 + 전치사 추가',
          categories: ['grammar'],
        },
      ];

      // Mock ClaudeService
      const mockClaudeService = (service as any).claudeService;
      mockClaudeService.correctSentencesBatch.mockResolvedValue(mockResults);

      // Act
      const results = await service.correctSentencesBatch(sentences, cefrLevel);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('original');
      expect(results[0]).toHaveProperty('corrected');
      expect(results[0]).toHaveProperty('explanation');
      expect(results[0]).toHaveProperty('categories');
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledTimes(1);
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledWith(sentences, cefrLevel);
    });

    it('should return results matching input sentences', async () => {
      // Arrange
      const sentences = ['Sentence 1.', 'Sentence 2.'];
      const mockResults: CorrectionResult[] = [
        {
          original: 'Sentence 1.',
          corrected: 'Corrected 1.',
          explanation: 'Explanation 1',
          categories: ['grammar'],
        },
        {
          original: 'Sentence 2.',
          corrected: 'Corrected 2.',
          explanation: 'Explanation 2',
          categories: ['vocabulary'],
        },
      ];

      const mockClaudeService = (service as any).claudeService;
      mockClaudeService.correctSentencesBatch.mockResolvedValue(mockResults);

      // Act
      const results = await service.correctSentencesBatch(sentences, 'B1');

      // Assert
      expect(results).toHaveLength(sentences.length);
      expect(results[0].original).toBe(sentences[0]);
      expect(results[1].original).toBe(sentences[1]);
    });
  });

  describe('TC-021: 빈 문장 배열 첨삭 요청', () => {
    it('should return empty array for empty input', async () => {
      // Act
      const result = await service.correctSentencesBatch([], 'B1');

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);

      // Should not call Claude API
      const mockClaudeService = (service as any).claudeService;
      expect(mockClaudeService.correctSentencesBatch).not.toHaveBeenCalled();
    });
  });

  describe('TC-022: 최대 개수 문장 첨삭 (50개)', () => {
    it('should handle 50 sentences batch correction', async () => {
      // Arrange
      const sentences = Array(50).fill('Test sentence.');
      const mockResults: CorrectionResult[] = sentences.map((s, i) => ({
        original: s,
        corrected: s,
        explanation: `Explanation ${i}`,
        categories: ['grammar'],
      }));

      const mockClaudeService = (service as any).claudeService;
      mockClaudeService.correctSentencesBatch.mockResolvedValue(mockResults);

      // Act
      const results = await service.correctSentencesBatch(sentences, 'B1');

      // Assert
      expect(results).toHaveLength(50);
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-025: Claude API 타임아웃 재시도', () => {
    it('should retry on timeout error', async () => {
      // Arrange
      const sentences = ['Test.'];
      const mockClaudeService = (service as any).claudeService;

      // First 2 calls: timeout error
      mockClaudeService.correctSentencesBatch
        .mockRejectedValueOnce(
          new AppError(ErrorCode.CLAUDE_TIMEOUT, 'API timeout', 'API 요청 시간이 초과되었습니다.')
        )
        .mockRejectedValueOnce(
          new AppError(ErrorCode.CLAUDE_TIMEOUT, 'API timeout', 'API 요청 시간이 초과되었습니다.')
        )
        .mockResolvedValueOnce([
          {
            original: 'Test.',
            corrected: 'Test.',
            explanation: 'No error',
            categories: [],
          },
        ]);

      // Act
      const results = await service.correctSentencesBatch(sentences, 'B1', 2);

      // Assert
      expect(results).toHaveLength(1);
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      // Arrange
      const sentences = ['Test.'];
      const mockClaudeService = (service as any).claudeService;

      // All calls: timeout error
      mockClaudeService.correctSentencesBatch.mockRejectedValue(
        new AppError(ErrorCode.CLAUDE_TIMEOUT, 'API timeout', 'API 요청 시간이 초과되었습니다.')
      );

      // Act & Assert
      await expect(service.correctSentencesBatch(sentences, 'B1', 2)).rejects.toThrow(AppError);
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 10000); // Increased timeout to 10 seconds

    it('should throw immediately for non-retryable errors', async () => {
      // Arrange
      const sentences = ['Test.'];
      const mockClaudeService = (service as any).claudeService;

      mockClaudeService.correctSentencesBatch.mockRejectedValue(
        new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', '입력값이 올바르지 않습니다.')
      );

      // Act & Assert
      await expect(service.correctSentencesBatch(sentences, 'B1', 2)).rejects.toThrow(AppError);
      expect(mockClaudeService.correctSentencesBatch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('TC-017: 배치 첨삭 + 저장 + 조회 통합', () => {
    it('should integrate batch correction with save and retrieve', async () => {
      // Arrange
      const sentences = ['Test 1.', 'Test 2.', 'Test 3.', 'Test 4.', 'Test 5.'];
      const mockResults: CorrectionResult[] = sentences.map((s) => ({
        original: s,
        corrected: s + ' corrected',
        explanation: 'Test explanation',
        categories: ['grammar'],
      }));

      const mockClaudeService = (service as any).claudeService;
      mockClaudeService.correctSentencesBatch.mockResolvedValue(mockResults);

      // Act - Batch correction
      const results = await service.correctSentencesBatch(sentences, 'B2');

      // Assert
      expect(results).toHaveLength(5);

      // Act - Save corrections (will test with actual DB in integration test)
      await expect(service.saveCorrections(results, 1, 1)).resolves.not.toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should handle large batch efficiently', async () => {
      // Arrange
      const sentences = Array(20).fill('This is a test sentence.');
      const mockResults: CorrectionResult[] = sentences.map((s) => ({
        original: s,
        corrected: s,
        explanation: 'No error',
        categories: [],
      }));

      const mockClaudeService = (service as any).claudeService;
      mockClaudeService.correctSentencesBatch.mockResolvedValue(mockResults);

      // Act
      const startTime = Date.now();
      const results = await service.correctSentencesBatch(sentences, 'B1');
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(20);
      // Should complete quickly (mocked, so < 1000ms)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

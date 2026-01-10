import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { CorrectionService } from '../../services/CorrectionService';
import { ErrorCode } from '../../errors/AppError';

// Mock better-sqlite3
const createMockDb = () => {
  const data: {
    corrections: Array<{
      id: number;
      session_id: number;
      topic_id: number;
      original_sentence: string;
      corrected_sentence: string;
      explanation: string;
      categories: string;
      created_at: string;
    }>;
  } = {
    corrections: [],
  };

  const mockDb = {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('SELECT * FROM corrections')) {
        return {
          all: vi.fn((...args: unknown[]) => {
            let result = [...data.corrections];

            // Parse WHERE conditions from SQL
            if (sql.includes('topic_id = ?')) {
              const topicId = args[0] as number;
              result = result.filter((c) => c.topic_id === topicId);
            }
            if (sql.includes('session_id = ?')) {
              const idx = sql.includes('topic_id = ?') ? 1 : 0;
              const sessionId = args[idx] as number;
              result = result.filter((c) => c.session_id === sessionId);
            }

            // LIMIT
            if (sql.includes('LIMIT ?')) {
              const limitIdx = sql.includes('topic_id = ?') && sql.includes('session_id = ?') ? 2 :
                              sql.includes('topic_id = ?') || sql.includes('session_id = ?') ? 1 : 0;
              const limit = args[limitIdx] as number;
              result = result.slice(0, limit);
            }

            return result;
          }),
        };
      }
      return {
        all: vi.fn(() => []),
      };
    }),
    getData: () => data,
    addCorrection: (correction: any) => {
      data.corrections.push(correction);
    },
    clearCorrections: () => {
      data.corrections = [];
    },
  };

  return mockDb;
};

describe('step4Handlers - correction:get-latest', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: CorrectionService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new CorrectionService(mockDb as unknown as import('better-sqlite3').Database);
  });

  describe('TC-005: correction:get-latest IPC Handler - 정상 조회', () => {
    it('should return latest corrections for valid sessionId and topicId', () => {
      // Arrange
      mockDb.addCorrection({
        id: 1,
        session_id: 1,
        topic_id: 1,
        original_sentence: 'I am student.',
        corrected_sentence: 'I am a student.',
        explanation: '부정관사 추가',
        categories: JSON.stringify(['grammar']),
        created_at: new Date().toISOString(),
      });

      mockDb.addCorrection({
        id: 2,
        session_id: 1,
        topic_id: 1,
        original_sentence: 'She go school.',
        corrected_sentence: 'She goes to school.',
        explanation: '3인칭 단수 동사 + 전치사 추가',
        categories: JSON.stringify(['grammar']),
        created_at: new Date().toISOString(),
      });

      mockDb.addCorrection({
        id: 3,
        session_id: 1,
        topic_id: 1,
        original_sentence: 'This is test.',
        corrected_sentence: 'This is a test.',
        explanation: '부정관사 추가',
        categories: JSON.stringify(['grammar']),
        created_at: new Date().toISOString(),
      });

      // Act
      const result = service.getCorrectionsHistory(1, 1);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].sessionId).toBe(1);
      expect(result[0].topicId).toBe(1);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should return data in CorrectionResult format', () => {
      // Arrange
      mockDb.addCorrection({
        id: 1,
        session_id: 1,
        topic_id: 1,
        original_sentence: 'Test sentence.',
        corrected_sentence: 'Test sentence corrected.',
        explanation: 'Test explanation',
        categories: JSON.stringify(['grammar', 'vocabulary']),
        created_at: new Date().toISOString(),
      });

      // Act
      const result = service.getCorrectionsHistory(1, 1);

      // Assert
      expect(result[0]).toHaveProperty('originalSentence');
      expect(result[0]).toHaveProperty('correctedSentence');
      expect(result[0]).toHaveProperty('explanation');
      expect(result[0]).toHaveProperty('categories');
      expect(result[0].categories).toBeInstanceOf(Array);
      expect(result[0].categories).toContain('grammar');
    });
  });

  describe('TC-002: correction:get-latest - 빈 결과', () => {
    it('should return empty array when no corrections exist', () => {
      // Act
      const result = service.getCorrectionsHistory(999, 999);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should not throw error for non-existent sessionId/topicId', () => {
      // Act & Assert
      expect(() => {
        service.getCorrectionsHistory(999, 999);
      }).not.toThrow();
    });
  });

  describe('TC-006: correction:get-latest - DB 에러 처리', () => {
    it('should throw error on database failure', () => {
      // Arrange
      const errorDb = {
        prepare: vi.fn(() => {
          throw new Error('DB connection failed');
        }),
      };

      const errorService = new CorrectionService(errorDb as unknown as import('better-sqlite3').Database);

      // Act & Assert
      expect(() => {
        errorService.getCorrectionsHistory(1, 1);
      }).toThrow('DB connection failed');
    });
  });

  describe('TC-012: getCorrectionsHistory() - limit 파라미터 검증', () => {
    it('should return limited number of corrections', () => {
      // Arrange - Add 100 corrections
      for (let i = 0; i < 100; i++) {
        mockDb.addCorrection({
          id: i + 1,
          session_id: 1,
          topic_id: 1,
          original_sentence: `Test ${i}.`,
          corrected_sentence: `Test ${i} corrected.`,
          explanation: `Explanation ${i}`,
          categories: JSON.stringify(['grammar']),
          created_at: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      // Act
      const result = service.getCorrectionsHistory(1, 1, 10);

      // Assert
      expect(result).toHaveLength(10);
    });

    it('should return all corrections when count is less than limit', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        mockDb.addCorrection({
          id: i + 1,
          session_id: 1,
          topic_id: 1,
          original_sentence: `Test ${i}.`,
          corrected_sentence: `Test ${i} corrected.`,
          explanation: `Explanation ${i}`,
          categories: JSON.stringify(['grammar']),
          created_at: new Date().toISOString(),
        });
      }

      // Act
      const result = service.getCorrectionsHistory(1, 1, 50);

      // Assert
      expect(result).toHaveLength(5);
    });
  });

  describe('TC-024: limit=0 조회 (경계값)', () => {
    it('should return empty array when limit is 0', () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        mockDb.addCorrection({
          id: i + 1,
          session_id: 1,
          topic_id: 1,
          original_sentence: `Test ${i}.`,
          corrected_sentence: `Test ${i} corrected.`,
          explanation: `Explanation ${i}`,
          categories: JSON.stringify(['grammar']),
          created_at: new Date().toISOString(),
        });
      }

      // Act
      const result = service.getCorrectionsHistory(1, 1, 0);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('TC-019: 여러 세션의 첨삭 결과 독립성', () => {
    it('should return corrections only for specified session', () => {
      // Arrange - Session 1: 3 corrections
      for (let i = 0; i < 3; i++) {
        mockDb.addCorrection({
          id: i + 1,
          session_id: 1,
          topic_id: 1,
          original_sentence: `Session 1 - Test ${i}.`,
          corrected_sentence: `Session 1 - Test ${i} corrected.`,
          explanation: `Explanation ${i}`,
          categories: JSON.stringify(['grammar']),
          created_at: new Date().toISOString(),
        });
      }

      // Session 2: 2 corrections
      for (let i = 0; i < 2; i++) {
        mockDb.addCorrection({
          id: i + 4,
          session_id: 2,
          topic_id: 1,
          original_sentence: `Session 2 - Test ${i}.`,
          corrected_sentence: `Session 2 - Test ${i} corrected.`,
          explanation: `Explanation ${i}`,
          categories: JSON.stringify(['grammar']),
          created_at: new Date().toISOString(),
        });
      }

      // Act
      const session1Results = service.getCorrectionsHistory(1, 1);
      const session2Results = service.getCorrectionsHistory(1, 2);

      // Assert
      expect(session1Results).toHaveLength(3);
      expect(session2Results).toHaveLength(2);
      expect(session1Results.every((c) => c.sessionId === 1)).toBe(true);
      expect(session2Results.every((c) => c.sessionId === 2)).toBe(true);
    });
  });
});

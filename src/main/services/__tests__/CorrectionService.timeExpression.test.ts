import { describe, it, expect, beforeEach } from 'vitest';
import { CorrectionService } from '../CorrectionService';

// Mock better-sqlite3
const createMockDb = () => {
  const mockDb = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    }),
    transaction: <T extends (...args: unknown[]) => unknown>(fn: T): T => {
      return ((...args: unknown[]) => {
        return fn(...args);
      }) as T;
    },
    exec: () => {},
    close: () => {},
  };

  return mockDb;
};

describe('CorrectionService - Time Expression Handling', () => {
  let service: CorrectionService;

  beforeEach(() => {
    const mockDb = createMockDb();
    service = new CorrectionService(mockDb as unknown as import('better-sqlite3').Database);
  });

  describe('TC-001: 소문자 a.m./p.m. 처리 (기본 케이스)', () => {
    it('should not split on lowercase a.m./p.m. time expressions', () => {
      const text = 'I woke up at 7 a.m. and went to sleep at 11 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('7 a.m.');
      expect(sentences[0]).toContain('11 p.m.');
    });

    it('should handle multiple a.m. occurrences', () => {
      const text = 'Meeting at 9 a.m. and another at 10 a.m. today.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9 a.m.');
      expect(sentences[0]).toContain('10 a.m.');
    });
  });

  describe('TC-002: 대문자 A.M./P.M. 처리', () => {
    it('should not split on uppercase A.M./P.M. time expressions', () => {
      const text = 'Meeting at 3 P.M. and another at 5 P.M.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('3 P.M.');
      expect(sentences[0]).toContain('5 P.M.');
    });

    it('should preserve original case format', () => {
      const text = 'The event starts at 2 A.M. sharp.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('2 A.M.');
      expect(sentences[0]).not.toContain('2 a.m.');
    });
  });

  describe('TC-003: 시:분 형식 처리 (콜론 포함)', () => {
    it('should handle time expressions with colon format (3:30 p.m.)', () => {
      const text = 'The meeting starts at 3:30 p.m. and ends at 5:00 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('3:30 p.m.');
      expect(sentences[0]).toContain('5:00 p.m.');
    });

    it('should handle single-digit minutes', () => {
      const text = 'Alarm set for 7:05 a.m. tomorrow.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('7:05 a.m.');
    });
  });

  describe('TC-004: AM/PM 형식 (마침표 없음)', () => {
    it('should handle AM/PM without periods', () => {
      const text = 'I arrived at 9 AM. The event started at 10 AM.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('9 AM');
      expect(sentences[1]).toContain('10 AM');
    });

    it('should handle lowercase am/pm without periods', () => {
      const text = 'The store opens at 9 am and closes at 6 pm.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9 am');
      expect(sentences[0]).toContain('6 pm');
    });
  });

  describe('TC-005: 버그 재현 케이스 (필수)', () => {
    it('should NOT split "3 p.m." into "3 p." and "m."', () => {
      const text = 'I kept sleeping and going to the bathroom over and over until around 3 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('3 p.m.');
      // Time expression should be preserved as-is, not split into separate parts
      expect(sentences[0]).toBe(text);
    });

    it('should handle the exact bug scenario', () => {
      const text = 'I kept sleeping until around 3 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe('I kept sleeping until around 3 p.m.');
    });
  });

  describe('TC-006: 공백 없는 시간 표현', () => {
    it('should handle time expressions without space (7a.m., 11p.m.)', () => {
      const text = 'I woke at 7a.m. and slept at 11p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('7a.m.');
      expect(sentences[0]).toContain('11p.m.');
    });

    it('should handle mixed spacing', () => {
      const text = 'First meeting at 9a.m. and second at 2 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9a.m.');
      expect(sentences[0]).toContain('2 p.m.');
    });
  });

  describe('TC-007: 복수 시간 표현 처리', () => {
    it('should handle multiple time expressions in one sentence', () => {
      const text = 'The shift runs from 9:00 a.m. to 5:30 p.m. daily.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9:00 a.m.');
      expect(sentences[0]).toContain('5:30 p.m.');
    });

    it('should handle more than two time expressions', () => {
      const text = 'Meetings at 9 a.m., 11 a.m., 2 p.m., and 4 p.m. today.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9 a.m.');
      expect(sentences[0]).toContain('11 a.m.');
      expect(sentences[0]).toContain('2 p.m.');
      expect(sentences[0]).toContain('4 p.m.');
    });
  });

  describe('TC-008: 대소문자 혼합 처리', () => {
    it('should handle various case combinations', () => {
      const cases = [
        'I slept until 3 p.m.',
        'I slept until 3 P.M.',
        'I slept until 3 PM.',
        'I slept until 3 pm.',
      ];

      cases.forEach((text) => {
        const sentences = service.splitSentences(text);
        expect(sentences).toHaveLength(1);
        expect(sentences[0]).toMatch(/3\s*(p\.m\.|P\.M\.|PM|pm)/);
      });
    });

    it('should preserve original case in mixed text', () => {
      const text = 'Wake at 7 A.M. and sleep at 11 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('7 A.M.');
      expect(sentences[0]).toContain('11 p.m.');
    });
  });

  describe('TC-009: 시간 표현 + 약어 조합', () => {
    it('should handle time expressions with abbreviations', () => {
      const text = 'Dr. Smith met me at 3 p.m. at the U.S. embassy.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('Dr. Smith');
      expect(sentences[0]).toContain('3 p.m.');
      expect(sentences[0]).toContain('U.S. embassy');
    });

    it('should handle multiple abbreviations and time expressions', () => {
      const text = 'Prof. Lee and Dr. Kim will meet at 2:30 p.m. in the U.S.A.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('Prof.');
      expect(sentences[0]).toContain('Dr.');
      expect(sentences[0]).toContain('2:30 p.m.');
      expect(sentences[0]).toContain('U.S.A.');
    });
  });

  describe('TC-010: 12시간 형식 경계값', () => {
    it('should handle 12 a.m. (midnight) and 12 p.m. (noon)', () => {
      const text = 'Midnight at 12 a.m. and noon at 12 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('12 a.m.');
      expect(sentences[0]).toContain('12 p.m.');
    });

    it('should handle single-digit hours', () => {
      const text = 'Wake at 1 a.m. and sleep at 9 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('1 a.m.');
      expect(sentences[0]).toContain('9 p.m.');
    });
  });

  describe('TC-011: 시간 표현 문장 끝', () => {
    it('should handle time expression at sentence end', () => {
      const text = 'I woke up at 7 a.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe('I woke up at 7 a.m.');
    });

    it('should handle multiple sentences ending with time expressions', () => {
      const text = 'First meeting at 9 a.m.! Second meeting at 2 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('9 a.m.');
      expect(sentences[1]).toContain('2 p.m.');
    });
  });

  describe('TC-012: 느낌표/물음표 + 시간 표현', () => {
    it('should split on exclamation marks and question marks', () => {
      const text = "What time is it? It's 3 p.m.! We're late!";
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('What time is it?');
      expect(sentences[1]).toContain('3 p.m.');
      expect(sentences[2]).toBe("We're late!");
    });

    it('should handle time expression before exclamation mark', () => {
      const text = "Meeting at 3 p.m.! Don't be late!";
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('3 p.m.');
    });
  });

  describe('TC-013: 30분 간격 처리', () => {
    it('should handle 30-minute intervals', () => {
      const text = 'Meetings at 2:30 p.m. and 4:30 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('2:30 p.m.');
      expect(sentences[0]).toContain('4:30 p.m.');
    });

    it('should handle various minute formats', () => {
      const text = 'Schedule: 9:00 a.m., 10:15 a.m., 11:30 a.m., 12:45 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9:00 a.m.');
      expect(sentences[0]).toContain('10:15 a.m.');
      expect(sentences[0]).toContain('11:30 a.m.');
      expect(sentences[0]).toContain('12:45 p.m.');
    });
  });

  describe('TC-014: 플레이스홀더 복원 검증', () => {
    it('should not return placeholder strings in result', () => {
      const text = 'Dr. Johnson arrived at 9:30 a.m. at the U.S. office.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).not.toContain('{{TIME_');
      expect(sentences[0]).not.toContain('{{ABBR_');
      expect(sentences[0]).toContain('Dr. Johnson');
      expect(sentences[0]).toContain('9:30 a.m.');
      expect(sentences[0]).toContain('U.S. office');
    });

    it('should restore all placeholders correctly', () => {
      const text = 'Prof. Lee met Dr. Kim at 2:00 p.m. at the U.S.A. embassy.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).not.toMatch(/\{\{.*?\}\}/);
      expect(sentences[0]).toContain('Prof.');
      expect(sentences[0]).toContain('Dr.');
      expect(sentences[0]).toContain('2:00 p.m.');
      expect(sentences[0]).toContain('U.S.A.');
    });
  });

  describe('TC-015: 연속된 시간 표현', () => {
    it('should handle consecutive time expressions', () => {
      const text = 'Available from 9 a.m. to 10 a.m. and 2 p.m. to 4 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9 a.m.');
      expect(sentences[0]).toContain('10 a.m.');
      expect(sentences[0]).toContain('2 p.m.');
      expect(sentences[0]).toContain('4 p.m.');
    });

    it('should handle time ranges', () => {
      const text = 'Office hours: 9:00 a.m. - 12:00 p.m. and 1:00 p.m. - 5:00 p.m.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('9:00 a.m.');
      expect(sentences[0]).toContain('12:00 p.m.');
      expect(sentences[0]).toContain('1:00 p.m.');
      expect(sentences[0]).toContain('5:00 p.m.');
    });
  });

  describe('회귀 테스트 - 기존 기능 유지', () => {
    it('TC-016: should maintain basic sentence splitting', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = service.splitSentences(text);

      expect(sentences).toEqual(['First sentence.', 'Second sentence!', 'Third sentence?']);
    });

    it('TC-017: should maintain abbreviation handling', () => {
      const text = 'Dr. Smith met Mrs. Johnson at the U.S. embassy.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toContain('Dr. Smith');
      expect(sentences[0]).toContain('Mrs. Johnson');
      expect(sentences[0]).toContain('U.S. embassy');
    });

    it('TC-018: should maintain whitespace trimming', () => {
      const text = '  First.  Second.  ';
      const sentences = service.splitSentences(text);

      expect(sentences).toEqual(['First.', 'Second.']);
      expect(sentences[0]).not.toMatch(/^\s|\s$/);
      expect(sentences[1]).not.toMatch(/^\s|\s$/);
    });

    it('TC-020: should maintain degree abbreviation handling', () => {
      const text = 'Dr. Kim has a Ph.D. in computer science. Prof. Lee has an M.D.';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('Ph.D.');
      expect(sentences[1]).toContain('M.D.');
    });
  });

  describe('경계값 테스트', () => {
    it('TC-021: should handle empty string', () => {
      const text = '';
      const sentences = service.splitSentences(text);

      expect(sentences).toEqual([]);
      expect(sentences).toHaveLength(0);
    });

    it('TC-022: should handle whitespace-only string', () => {
      const text = '   \n\t   ';
      const sentences = service.splitSentences(text);

      expect(sentences).toEqual([]);
      expect(sentences).toHaveLength(0);
    });

    it('TC-023: should handle very long sentence (1000+ chars)', () => {
      const longText = 'I woke up at 7 a.m. ' + 'and '.repeat(500) + 'went to sleep at 11 p.m.';
      const startTime = Date.now();
      const sentences = service.splitSentences(longText);
      const endTime = Date.now();

      expect(sentences).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(100);
      expect(sentences[0]).toContain('7 a.m.');
    });

    it('TC-024: should handle special characters', () => {
      const text = 'Meeting at 3 p.m. 🕒! See you!';
      const sentences = service.splitSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('3 p.m.');
      expect(sentences[0]).toContain('🕒');
    });
  });

  describe('에러 케이스', () => {
    it('TC-026: should handle null/undefined input', () => {
      expect(service.splitSentences(null as unknown as string)).toEqual([]);
      expect(service.splitSentences(undefined as unknown as string)).toEqual([]);
    });

    it('should handle text with manually inserted placeholders', () => {
      const text = 'Text with {{TIME_0}} placeholder.';

      expect(() => service.splitSentences(text)).not.toThrow();
      const sentences = service.splitSentences(text);

      // Result may vary depending on implementation
      expect(Array.isArray(sentences)).toBe(true);
    });
  });
});

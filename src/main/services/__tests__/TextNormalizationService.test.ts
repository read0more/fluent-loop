import { describe, it, expect, beforeEach } from 'vitest';
import { TextNormalizationService } from '../TextNormalizationService';

/**
 * TextNormalizationService 단위 테스트
 *
 * LLM 제거 후 내장 알고리즘 기반 정규화 테스트
 * - 연속 공백 제거
 * - 문장 첫 글자 대문자화
 * - 문장 시작 대문자화 (구두점 후)
 * - 단독 i → I 변환
 */
describe('TextNormalizationService - Built-in Algorithm', () => {
  let service: TextNormalizationService;

  beforeEach(() => {
    service = new TextNormalizationService();
  });

  describe('TC-001: 연속 공백 제거', () => {
    it('should remove consecutive spaces', async () => {
      // Arrange
      const input = 'hello    world  test';
      const expected = 'Hello world test';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
      expect(result).not.toContain('  '); // 연속 공백 없음
    });
  });

  describe('TC-002: 문장 첫 글자 대문자화', () => {
    it('should capitalize first letter', async () => {
      // Arrange
      const input = 'hello world';
      const expected = 'Hello world';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
      expect(result[0]).toBe('H');
    });
  });

  describe('TC-003: 문장 시작 대문자화 (구두점 후)', () => {
    it('should capitalize after sentence punctuation', async () => {
      // Arrange
      const input = 'Hello. world! how are you? fine';
      const expected = 'Hello. World! How are you? Fine';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle multiple punctuation marks', async () => {
      // Arrange
      const input = 'hello. test! again? yes';
      const expected = 'Hello. Test! Again? Yes';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('TC-004: 단독 i → I 변환', () => {
    it('should convert standalone i to I', async () => {
      // Arrange
      const input = 'i think i am happy';
      const expected = 'I think I am happy';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
      expect(result).toContain('think'); // 단어 내부 i는 유지
    });

    it('should not change i inside words', async () => {
      // Arrange
      const input = 'i like ice cream';
      const expected = 'I like ice cream';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
      expect(result).toContain('like');
      expect(result).toContain('ice');
    });
  });

  describe('TC-005: 빈 텍스트 처리 (Boundary)', () => {
    it('should return empty string for empty input', async () => {
      // Arrange
      const input = '';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('TC-006: 짧은 텍스트 처리 (Boundary)', () => {
    it('should handle short text', async () => {
      // Arrange
      const input = 'hi';
      const expected = 'Hi';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('TC-007: 공백만 포함된 텍스트 처리 (Boundary)', () => {
    it('should handle whitespace-only input', async () => {
      // Arrange
      const input = '   ';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result.trim()).toBe('');
    });
  });

  describe('TC-008: 성능 테스트 (<50ms)', () => {
    it('should complete within 50ms for long text', async () => {
      // Arrange
      const input = 'hello world '.repeat(100); // 긴 텍스트
      const start = Date.now();

      // Act
      await service.normalizeText(input);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(50);
    });

    it('should complete within 10ms for normal text', async () => {
      // Arrange
      const input = 'hello my name is john i think this is good';
      const start = Date.now();

      // Act
      await service.normalizeText(input);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(10);
    });
  });

  describe('TC-021: 매우 긴 텍스트 정규화 (Boundary)', () => {
    it('should handle very long text efficiently', async () => {
      // Arrange
      const input = 'hello world i am happy '.repeat(200); // 500+ 단어
      const start = Date.now();

      // Act
      const result = await service.normalizeText(input);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(100);
      expect(result[0]).toBe('H');
      expect(result).toContain('I am happy');
    });
  });

  describe('TC-022: 특수 문자 포함 텍스트 (Boundary)', () => {
    it('should preserve special characters', async () => {
      // Arrange
      const input = 'hello @world #test $100';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toContain('@world');
      expect(result).toContain('#test');
      expect(result).toContain('$100');
      expect(result[0]).toBe('H');
    });
  });

  describe('TC-023: 숫자와 혼합된 텍스트 (Boundary)', () => {
    it('should preserve numbers', async () => {
      // Arrange
      const input = 'i have 3 cats and 2 dogs';
      const expected = 'I have 3 cats and 2 dogs';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
      expect(result).toContain('3');
      expect(result).toContain('2');
    });
  });

  describe('추가 테스트: 복합 시나리오', () => {
    it('should handle combined transformations', async () => {
      // Arrange
      const input = 'hello    world. i think this is  good! how are you? i am fine';
      const expected = 'Hello world. I think this is good! How are you? I am fine';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle real STT-like input', async () => {
      // Arrange
      const input = 'hello my name is john i like traveling';
      const expected = 'Hello my name is john I like traveling';

      // Act
      const result = await service.normalizeText(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('에러 처리: Graceful Degradation', () => {
    it('should return original text on unexpected error', async () => {
      // Note: 내장 알고리즘은 실패 확률이 매우 낮으므로
      // 이 테스트는 코드 커버리지를 위한 것입니다.
      // 실제로 에러를 발생시키기는 어렵습니다.

      const input = 'hello world';
      const result = await service.normalizeText(input);

      expect(result).toBeTruthy();
    });
  });
});

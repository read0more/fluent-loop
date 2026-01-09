import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { AppError } from '../../errors/AppError';

// Private 메서드 테스트를 위한 타입 정의
interface ClaudeServiceTestable {
  parseCorrectionResponse(output: string): {
    original: string;
    corrected: string;
    explanation: string;
    categories: string[];
  };
  buildCorrectionPrompt(sentence: string, cefrLevel: string): string;
}

describe('ClaudeService - Correction Features', () => {
  let service: ClaudeService;
  let testableService: ClaudeServiceTestable;

  beforeEach(() => {
    service = new ClaudeService();
    testableService = service as unknown as ClaudeServiceTestable;
  });

  describe('TC-001: correctSentence() - Grammar error correction', () => {
    // Skip: This is an integration test that requires actual Claude CLI
    it.skip('should correct past tense error', async () => {
      // Note: This test requires actual Claude CLI execution
      // In a real test environment, this should be mocked
      const result = await service.correctSentence('I go to school yesterday.', 'B1');

      expect(result).toBeDefined();
      expect(result.original).toBe('I go to school yesterday.');
      expect(result.corrected).toContain('went');
      expect(result.categories).toContain('grammar');
      expect(result.explanation).toBeTruthy();
    }, 30000); // 30 second timeout for AI call
  });

  describe('TC-003: correctSentence() - Subject-verb disagreement', () => {
    // Skip: This is an integration test that requires actual Claude CLI
    it.skip('should correct subject-verb agreement error', async () => {
      const result = await service.correctSentence("She don't like apples.", 'A2');

      expect(result.corrected).toContain("doesn't");
      expect(result.categories).toContain('grammar');
      expect(result.explanation).toMatch(/3인칭|단수|doesn't/i);
    }, 30000);
  });

  describe('TC-010: parseCorrectionResponse() - JSON parsing', () => {
    it('should parse markdown code block with JSON', () => {
      const output =
        '```json\n{"original":"test", "corrected":"test", "explanation":"ok", "categories":[]}\n```';
      const result = testableService.parseCorrectionResponse(output);

      expect(result.original).toBe('test');
      expect(result.corrected).toBe('test');
      expect(result.explanation).toBe('ok');
      expect(result.categories).toEqual([]);
    });

    it('should parse plain JSON without code blocks', () => {
      const output =
        '{"original":"test", "corrected":"corrected", "explanation":"Fixed", "categories":["grammar"]}';
      const result = testableService.parseCorrectionResponse(output);

      expect(result.original).toBe('test');
      expect(result.corrected).toBe('corrected');
      expect(result.categories).toEqual(['grammar']);
    });
  });

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

  describe('TC-021: Special characters handling', () => {
    // Skip: This is an integration test that requires actual Claude CLI
    it.skip('should preserve special characters in sentence', async () => {
      const sentence = "I can't believe it! Really?";
      const result = await service.correctSentence(sentence, 'B1');

      expect(result.original).toContain("'");
      expect(result.original).toContain('!');
      expect(result.original).toContain('?');
    }, 30000);
  });

  describe('TC-022: AI response parsing failure', () => {
    it('should throw parsing error for invalid JSON', () => {
      const invalidJSON = 'This is not JSON';

      expect(() => {
        testableService.parseCorrectionResponse(invalidJSON);
      }).toThrow(AppError);

      try {
        testableService.parseCorrectionResponse(invalidJSON);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).userMessage).toContain('파싱에 실패');
      }
    });

    it('should throw parsing error for incomplete JSON', () => {
      const incompleteJSON = '{"original":"test"}'; // Missing required fields

      expect(() => {
        testableService.parseCorrectionResponse(incompleteJSON);
      }).toThrow(AppError);
    });
  });

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
  });
});

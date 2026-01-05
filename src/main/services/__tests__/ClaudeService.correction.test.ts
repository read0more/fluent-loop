import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';

describe('ClaudeService - Correction Features', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  describe('TC-001: correctSentence() - Grammar error correction', () => {
    it('should correct past tense error', async () => {
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

  describe('TC-002: correctSentence() - Already correct sentence', () => {
    it('should return original if sentence is correct', async () => {
      const result = await service.correctSentence('I went to school yesterday.', 'B1');

      expect(result.original).toBe('I went to school yesterday.');
      expect(result.corrected).toBe('I went to school yesterday.');
      expect(result.explanation).toMatch(/no correction|수정.*필요|올바름|수정할 부분이 없|문법적으로 올바른|문법적으로 정확한|문법적으로 완벽/i);
    }, 30000);
  });

  describe('TC-003: correctSentence() - Subject-verb disagreement', () => {
    it('should correct subject-verb agreement error', async () => {
      const result = await service.correctSentence("She don't like apples.", 'A2');

      expect(result.corrected).toContain("doesn't");
      expect(result.categories).toContain('grammar');
      expect(result.explanation).toMatch(/3인칭|단수|doesn't/i);
    }, 30000);
  });

  describe('TC-004: correctSentence() - Vocabulary improvement', () => {
    it('should suggest vocabulary improvements for B2+ levels', async () => {
      const result = await service.correctSentence('The movie was very boring.', 'B2');

      expect(result).toBeDefined();
      expect(result.categories).toContain('vocabulary');
      expect(result.explanation).toBeTruthy();
    }, 30000);
  });

  describe('TC-010: parseCorrectionResponse() - JSON parsing', () => {
    it('should parse markdown code block with JSON', () => {
      const output = '```json\n{"original":"test", "corrected":"test", "explanation":"ok", "categories":[]}\n```';
      const result = (service as any).parseCorrectionResponse(output);

      expect(result.original).toBe('test');
      expect(result.corrected).toBe('test');
      expect(result.explanation).toBe('ok');
      expect(result.categories).toEqual([]);
    });

    it('should parse plain JSON without code blocks', () => {
      const output = '{"original":"test", "corrected":"corrected", "explanation":"Fixed", "categories":["grammar"]}';
      const result = (service as any).parseCorrectionResponse(output);

      expect(result.original).toBe('test');
      expect(result.corrected).toBe('corrected');
      expect(result.categories).toEqual(['grammar']);
    });
  });

  describe('TC-017: Empty string validation', () => {
    it('should throw validation error for empty sentence', async () => {
      await expect(
        service.correctSentence('', 'B1')
      ).rejects.toThrow(AppError);

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
      await expect(
        service.correctSentence('   ', 'B1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('TC-019: Very long text validation', () => {
    it('should throw validation error for sentence longer than 500 characters', async () => {
      const longSentence = 'A'.repeat(501);

      await expect(
        service.correctSentence(longSentence, 'B1')
      ).rejects.toThrow(AppError);

      try {
        await service.correctSentence(longSentence, 'B1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).userMessage).toContain('너무 깁니다');
      }
    });
  });

  describe('TC-020: Already perfect sentence', () => {
    it('should return original for perfect sentence', async () => {
      const perfectSentence = 'The quick brown fox jumps over the lazy dog.';
      const result = await service.correctSentence(perfectSentence, 'C1');

      expect(result.corrected).toBe(perfectSentence);
      expect(result.explanation).toMatch(/no correction|수정.*필요|수정할 부분이 없|문법적으로 올바른|문법적으로 정확한|문법적으로 완벽/i);
    }, 30000);
  });

  describe('TC-021: Special characters handling', () => {
    it('should preserve special characters in sentence', async () => {
      const sentence = "I can't believe it! Really?";
      const result = await service.correctSentence(sentence, 'B1');

      expect(result.original).toContain("'");
      expect(result.original).toContain("!");
      expect(result.original).toContain("?");
    }, 30000);
  });

  describe('TC-022: AI response parsing failure', () => {
    it('should throw parsing error for invalid JSON', () => {
      const invalidJSON = 'This is not JSON';

      expect(() => {
        (service as any).parseCorrectionResponse(invalidJSON);
      }).toThrow(AppError);

      try {
        (service as any).parseCorrectionResponse(invalidJSON);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).userMessage).toContain('파싱에 실패');
      }
    });

    it('should throw parsing error for incomplete JSON', () => {
      const incompleteJSON = '{"original":"test"}'; // Missing required fields

      expect(() => {
        (service as any).parseCorrectionResponse(incompleteJSON);
      }).toThrow(AppError);
    });
  });

  describe('buildCorrectionPrompt() - Prompt generation', () => {
    it('should include sentence and CEFR level in prompt', () => {
      const sentence = 'I go to school yesterday.';
      const cefrLevel = 'B1';
      const prompt = (service as any).buildCorrectionPrompt(sentence, cefrLevel);

      expect(prompt).toContain(sentence);
      expect(prompt).toContain('B1');
      expect(prompt).toContain('grammar');
      expect(prompt).toContain('vocabulary');
      expect(prompt).toContain('naturalness');
    });

    it('should include level-specific instructions', () => {
      const sentence = 'Test sentence.';
      const promptA1 = (service as any).buildCorrectionPrompt(sentence, 'A1');
      const promptC1 = (service as any).buildCorrectionPrompt(sentence, 'C1');

      expect(promptA1).toContain('A1');
      expect(promptC1).toContain('C1');
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';
import type { Message, CEFRLevel } from '../../database/models';

/**
 * ClaudeService - STT 정규화 최적화 관련 테스트
 *
 * 2단계 첨삭 프롬프트 (정규화 + 첨삭) 및 normalized 필드 테스트
 */
describe('ClaudeService - STT Normalization Optimization', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  describe('TC-009: 프롬프트에 정규화 단계 포함 확인', () => {
    it('should include normalization step in prompt', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello my name is john',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];
      const cefrLevel: CEFRLevel = 'B1';
      const topicContent = 'Travel';

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(
        messages,
        cefrLevel,
        topicContent
      );

      // Assert
      expect(prompt).toContain('Normalization');
      expect(prompt).toContain('normalized');
      expect(prompt).toContain('Step 1');
      expect(prompt).toContain('Step 2');
    });

    it('should explain 2-step correction process', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(messages, 'B1', 'Topic');

      // Assert
      expect(prompt).toContain('2-step correction');
      expect(prompt).toContain('punctuation');
      expect(prompt).toContain('capitalization');
    });

    it('should mention normalized field in JSON output format', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(messages, 'B1', 'Topic');

      // Assert
      expect(prompt).toContain('"normalized"');
    });
  });

  describe('TC-010: normalized 필드 파싱 성공', () => {
    it('should parse normalized field from LLM response', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "hello",
          "normalized": "Hello.",
          "corrected": "Hello.",
          "explanation": "구두점 추가",
          "categories": ["punctuation"],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].normalized).toBe('Hello.');
      expect(result[0].normalized).toBeDefined();
    });

    it('should parse multiple messages with normalized field', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "hello my name is john",
          "normalized": "Hello, my name is John.",
          "corrected": "Hello, my name is John.",
          "explanation": "구두점과 이름 대문자화",
          "categories": ["punctuation"],
          "timestamp": 5
        },
        {
          "messageId": 2,
          "speaker": "user",
          "original": "i think this is good",
          "normalized": "I think this is good.",
          "corrected": "I think this is good.",
          "explanation": "i → I, 마침표 추가",
          "categories": ["punctuation"],
          "timestamp": 10
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello my name is john',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'i think this is good',
          timestamp: 10,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].normalized).toBe('Hello, my name is John.');
      expect(result[1].normalized).toBe('I think this is good.');
    });
  });

  describe('TC-011: normalized 필드 누락 시 에러', () => {
    it('should throw error if normalized field is missing', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "hello",
          "corrected": "Hello.",
          "explanation": "구두점 추가",
          "categories": [],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(mockResponse, allMessages);
      }).toThrow(AppError);
    });

    it('should throw CLAUDE_PARSING_ERROR with normalized keyword', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "hello",
          "corrected": "Hello.",
          "explanation": "구두점 추가",
          "categories": ["punctuation"],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act & Assert
      try {
        (service as any).parseConversationCorrectionResponse(mockResponse, allMessages);
        fail('Should throw AppError');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.CLAUDE_PARSING_ERROR);
        expect((error as AppError).message).toContain('normalized');
      }
    });
  });

  describe('TC-012: AI 메시지 normalized = original', () => {
    it('should have normalized equal to original for AI messages', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 2,
          "speaker": "user",
          "original": "hello",
          "normalized": "Hello.",
          "corrected": "Hello.",
          "explanation": "구두점 추가",
          "categories": ["punctuation"],
          "timestamp": 10
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Hello there!',
          timestamp: 3,
          audioPath: '/path/to/ai.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 10,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      const aiCorrection = result.find((c: any) => c.speaker === 'ai');
      expect(aiCorrection).toBeDefined();
      expect(aiCorrection.normalized).toBe(aiCorrection.original);
      expect(aiCorrection.corrected).toBe(aiCorrection.original);
      expect(aiCorrection.explanation).toBe('');
      expect(aiCorrection.categories).toEqual([]);
    });
  });

  describe('TC-020: 프롬프트에 대화 컨텍스트 포함', () => {
    it('should include full conversation history in prompt', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'ai',
          content: 'hi',
          timestamp: 8,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
      ];

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(messages, 'B1', 'Travel');

      // Assert
      expect(prompt).toContain('[Student]');
      expect(prompt).toContain('[AI]');
      expect(prompt).toContain('hello');
      expect(prompt).toContain('hi');
    });

    it('should include topic content in prompt', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];
      const topicContent = 'Traveling to Paris';

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(
        messages,
        'B1',
        topicContent
      );

      // Assert
      expect(prompt).toContain('Traveling to Paris');
    });
  });

  describe('TC-018: 정규화 단계와 첨삭 단계 구분', () => {
    it('should differentiate between normalized and corrected', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "hello my name is john",
          "normalized": "Hello, my name is John.",
          "corrected": "Hello, my name is John.",
          "explanation": "구두점(콤마, 마침표)을 추가하고 이름의 첫 글자를 대문자로 수정했습니다.",
          "categories": ["punctuation"],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'hello my name is john',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result[0].normalized).toContain('.');
      expect(result[0].normalized).toMatch(/^[A-Z]/);
      expect(result[0].explanation).toMatch(/구두점|punctuation/i);
    });

    it('should handle case where normalized and corrected differ', () => {
      // Arrange - 정규화 후 추가 첨삭이 있는 경우
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "i go park yesterday",
          "normalized": "I go park yesterday.",
          "corrected": "I went to the park yesterday.",
          "explanation": "정규화: i → I, 마침표 추가. 첨삭: go → went (과거형), to the park (전치사 추가)",
          "categories": ["punctuation", "grammar"],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'i go park yesterday',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result[0].original).toBe('i go park yesterday');
      expect(result[0].normalized).toBe('I go park yesterday.');
      expect(result[0].corrected).toBe('I went to the park yesterday.');
      expect(result[0].categories).toContain('punctuation');
      expect(result[0].categories).toContain('grammar');
    });
  });

  describe('추가 테스트: 복합 시나리오', () => {
    it('should handle conversation with multiple user messages', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 2,
          "speaker": "user",
          "original": "hello",
          "normalized": "Hello.",
          "corrected": "Hello.",
          "explanation": "마침표 추가",
          "categories": ["punctuation"],
          "timestamp": 5
        },
        {
          "messageId": 4,
          "speaker": "user",
          "original": "i like traveling",
          "normalized": "I like traveling.",
          "corrected": "I like traveling.",
          "explanation": "i → I, 마침표 추가",
          "categories": ["punctuation"],
          "timestamp": 15
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Hi!',
          timestamp: 0,
          audioPath: '/path1.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'hello',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
        {
          id: 3,
          conversationId: 1,
          speaker: 'ai',
          content: 'What do you like?',
          timestamp: 10,
          audioPath: '/path2.mp3',
          createdAt: new Date(),
        },
        {
          id: 4,
          conversationId: 1,
          speaker: 'user',
          content: 'i like traveling',
          timestamp: 15,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result).toHaveLength(4);

      const userCorrections = result.filter((c: any) => c.speaker === 'user');
      expect(userCorrections).toHaveLength(2);

      userCorrections.forEach((c: any) => {
        expect(c.normalized).toBeDefined();
        expect(c.corrected).toBeDefined();
      });
    });

    it('should handle perfect sentence (normalized = corrected = original)', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 1,
          "speaker": "user",
          "original": "I think this is correct.",
          "normalized": "I think this is correct.",
          "corrected": "I think this is correct.",
          "explanation": "수정이 필요하지 않습니다.",
          "categories": [],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'I think this is correct.',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = (service as any).parseConversationCorrectionResponse(
        mockResponse,
        allMessages
      );

      // Assert
      expect(result[0].original).toBe(result[0].normalized);
      expect(result[0].normalized).toBe(result[0].corrected);
      expect(result[0].categories).toEqual([]);
    });
  });
});

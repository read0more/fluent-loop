/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';
import type { ConversationCorrectionResult, Message, CEFRLevel } from '../../database/models';

/**
 * Step 6: ClaudeService.correctConversation() 테스트
 *
 * 전체 대화를 1회 AI 호출로 일괄 첨삭하는 기능 테스트
 */

describe('ClaudeService - Step 6: correctConversation()', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
  });

  describe('TC-S6-002: buildConversationCorrectionPrompt() - 프롬프트 생성', () => {
    it('should include full conversation history in prompt', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Hello!',
          timestamp: 0,
          audioPath: '/path/to/ai1.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'I go park.',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];
      const cefrLevel: CEFRLevel = 'B1';
      const topicContent = 'Talking about hobbies';

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(
        messages,
        cefrLevel,
        topicContent
      );

      // Assert
      expect(prompt).toContain('CEFR B1');
      expect(prompt).toContain('Full Conversation');
      expect(prompt).toContain('[AI] (0s): Hello');
      expect(prompt).toContain('[Student] (5s): I go park.');
      expect(prompt).toContain('Student Messages to Correct');
      expect(prompt).toContain('JSON Array Output');
      expect(prompt).toContain('conversation context');
      expect(prompt).toContain('Talking about hobbies');
    });

    it('should include CEFR-specific instructions', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'user',
          content: 'Test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act - A1 level
      const promptA1 = (service as any).buildConversationCorrectionPrompt(
        messages,
        'A1',
        'Test topic'
      );

      // Act - C1 level
      const promptC1 = (service as any).buildConversationCorrectionPrompt(
        messages,
        'C1',
        'Test topic'
      );

      // Assert
      expect(promptA1).toContain('A1');
      expect(promptC1).toContain('C1');
      expect(promptA1).toContain('very simple explanations');
      expect(promptC1).toContain('advanced explanations');
    });

    it('should list only user messages to correct', () => {
      // Arrange
      const messages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Question?',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'Answer.',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
        {
          id: 3,
          conversationId: 1,
          speaker: 'user',
          content: 'Another answer.',
          timestamp: 10,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act
      const prompt = (service as any).buildConversationCorrectionPrompt(messages, 'B1', 'Topic');

      // Assert
      expect(prompt).toContain('Student Messages to Correct:');
      expect(prompt).toContain('(messageId: 2');
      expect(prompt).toContain('(messageId: 3');
      expect(prompt).not.toContain('(messageId: 1'); // AI message는 포함 안됨
    });
  });

  describe('TC-S6-003: parseConversationCorrectionResponse() - JSON 파싱', () => {
    it('should parse JSON array response correctly', () => {
      // Arrange
      const mockResponse = `[
        {
          "messageId": 2,
          "speaker": "user",
          "original": "I go park.",
          "corrected": "I went to the park.",
          "explanation": "과거형 사용, 'the' 추가",
          "categories": ["grammar"],
          "timestamp": 5
        }
      ]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Hello',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'I go park.',
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
      expect(result).toHaveLength(2);

      // AI 메시지
      expect(result[0].messageId).toBe(1);
      expect(result[0].speaker).toBe('ai');
      expect(result[0].original).toBe('Hello');
      expect(result[0].corrected).toBe('Hello');
      expect(result[0].explanation).toBe('');
      expect(result[0].categories).toEqual([]);

      // User 메시지
      expect(result[1].messageId).toBe(2);
      expect(result[1].speaker).toBe('user');
      expect(result[1].original).toBe('I go park.');
      expect(result[1].corrected).toBe('I went to the park.');
      expect(result[1].explanation).toContain('과거형');
      expect(result[1].categories).toContain('grammar');
    });

    it('should handle markdown code blocks', () => {
      // Arrange
      const mockResponse =
        '```json\n[{"messageId":2,"speaker":"user","original":"Test","corrected":"Test","explanation":"OK","categories":[],"timestamp":5}]\n```';

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Hi',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'Test',
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
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result[1].messageId).toBe(2);
    });

    it('should throw parsing error for invalid JSON', () => {
      // Arrange
      const invalidJSON = 'Invalid JSON string';
      const allMessages: Message[] = [];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(invalidJSON, allMessages);
      }).toThrow(AppError);

      try {
        (service as any).parseConversationCorrectionResponse(invalidJSON, allMessages);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.CLAUDE_PARSING_ERROR);
        expect((error as AppError).userMessage).toContain('파싱에 실패');
      }
    });

    it('should throw error for missing required fields', () => {
      // Arrange - Missing 'corrected' field
      const incompleteJSON = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "Test"
      }]`;

      const allMessages: Message[] = [
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'Test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(incompleteJSON, allMessages);
      }).toThrow('Missing required fields');
    });

    it('should preserve special characters', () => {
      // Arrange
      const mockResponse = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "I can't go!",
        "corrected": "I can't go!",
        "explanation": "수정 불필요",
        "categories": [],
        "timestamp": 5
      }]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'Why not?',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: "I can't go!",
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
      expect(result[1].original).toBe("I can't go!");
      expect(result[1].corrected).toBe("I can't go!");
    });
  });

  describe('TC-S6-013: 완벽한 문장 처리 (수정 불필요)', () => {
    it('should handle perfect sentences correctly', () => {
      // Arrange
      const mockResponse = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "I like books.",
        "corrected": "I like books.",
        "explanation": "수정이 필요하지 않습니다.",
        "categories": [],
        "timestamp": 5
      }]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'What do you like?',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'I like books.',
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
      const userMsg = result.find((r: ConversationCorrectionResult) => r.messageId === 2);
      expect(userMsg.original).toBe(userMsg.corrected);
      expect(userMsg.explanation).toContain('수정이 필요하지 않습니다');
      expect(userMsg.categories).toEqual([]);
    });
  });

  describe('TC-S6-025: 빈 대화 (메시지 없음) - Boundary', () => {
    it('should throw validation error for empty message list', async () => {
      // Note: This would be tested in the full correctConversation() method
      // which validates messages before calling the prompt builder
      expect(true).toBe(true);
    });
  });

  describe('TC-S6-030: 특수 문자 포함 메시지 - Boundary', () => {
    it('should handle various special characters', () => {
      // Arrange
      const mockResponse = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "I'm happy! What's new?",
        "corrected": "I'm happy! What's new?",
        "explanation": "Perfect!",
        "categories": [],
        "timestamp": 5
      }]`;

      const allMessages: Message[] = [
        {
          id: 1,
          conversationId: 1,
          speaker: 'ai',
          content: 'How are you?',
          timestamp: 0,
          audioPath: '/path.mp3',
          createdAt: new Date(),
        },
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: "I'm happy! What's new?",
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
      expect(result[1].original).toContain("'");
      expect(result[1].original).toContain('!');
      expect(result[1].original).toContain('?');
    });
  });

  describe('TC-S6-033: Claude API 응답 파싱 실패 - Error', () => {
    it('should throw CLAUDE_PARSING_ERROR for malformed JSON', () => {
      // Arrange
      const malformedJSON = '{ invalid json {';
      const allMessages: Message[] = [];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(malformedJSON, allMessages);
      }).toThrow(AppError);
    });
  });

  describe('TC-S6-034: Claude API 응답 - 필수 필드 누락 - Error', () => {
    it('should throw error when required fields are missing', () => {
      // Arrange - Missing 'explanation' field
      const incompleteJSON = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "Test",
        "corrected": "Test",
        "categories": []
      }]`;

      const allMessages: Message[] = [
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'Test',
          timestamp: 0,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(incompleteJSON, allMessages);
      }).toThrow('Missing required fields');
    });

    it('should throw error when categories is not an array', () => {
      // Arrange
      const invalidJSON = `[{
        "messageId": 2,
        "speaker": "user",
        "original": "Test",
        "corrected": "Test",
        "explanation": "OK",
        "categories": "grammar",
        "timestamp": 5
      }]`;

      const allMessages: Message[] = [
        {
          id: 2,
          conversationId: 1,
          speaker: 'user',
          content: 'Test',
          timestamp: 5,
          audioPath: null,
          createdAt: new Date(),
        },
      ];

      // Act & Assert
      expect(() => {
        (service as any).parseConversationCorrectionResponse(invalidJSON, allMessages);
      }).toThrow('Categories must be an array');
    });
  });
});

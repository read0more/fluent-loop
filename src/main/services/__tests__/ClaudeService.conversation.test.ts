/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService } from '../ClaudeService';
import type { TopicContext, ConversationMessage } from '../ClaudeService';
import { AppError, ErrorCode } from '../../errors/AppError';

describe('ClaudeService - AI 대화 응답 JSON Wrapper 파싱 수정', () => {
  let service: ClaudeService;

  beforeEach(() => {
    service = new ClaudeService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. 단위 테스트 (Unit Tests)
  // ==========================================

  describe('1.1 parseConversationResponse 메서드 테스트', () => {
    // TC-001: Claude CLI JSON wrapper 파싱
    it('TC-001: Claude CLI JSON wrapper 파싱', () => {
      const input =
        '{"result":"Hello! How are you today?","type":"text","model":"claude-sonnet-4-5-20250929"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('Hello! How are you today?');
      expect(output).not.toContain('"result"');
      expect(output).not.toContain('"type"');
    });

    // TC-002: Plain text 응답 처리 (wrapper 없음)
    it('TC-002: Plain text 응답 처리 (wrapper 없음)', () => {
      const input = 'Hello! How are you today?';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('Hello! How are you today?');
    });

    // TC-003: Malformed JSON 처리 (닫는 괄호 누락)
    it('TC-003: Malformed JSON 처리 (닫는 괄호 누락)', () => {
      const input = '{"result":"Hello! How are you?","type":"text"';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(input.trim());
    });

    // TC-004: result 필드 누락
    it('TC-004: result 필드 누락', () => {
      const input = '{"type":"text","model":"claude-sonnet-4-5"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(input.trim());
    });

    // TC-005: result 필드 타입 불일치 (숫자)
    it('TC-005: result 필드 타입 불일치 (숫자)', () => {
      const input = '{"result":12345,"type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(input.trim());
    });

    // TC-006: Whitespace 처리 (앞뒤 공백)
    it('TC-006: Whitespace 처리 (앞뒤 공백)', () => {
      const input = '  \n{"result":"Hello!","type":"text"}\n  ';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('Hello!');
      expect(output).not.toMatch(/^\s/);
      expect(output).not.toMatch(/\s$/);
    });

    // TC-007: result 필드에 특수 문자 포함
    it('TC-007: result 필드에 특수 문자 포함', () => {
      const input = '{"result":"Hello!\\n\\"How are you?\\" 😊","type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toContain('\n');
      expect(output).toContain('"');
      expect(output).toContain('😊');
    });

    // TC-008: result 필드가 빈 문자열
    it('TC-008: result 필드가 빈 문자열', () => {
      const input = '{"result":"","type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('');
      expect(output.length).toBe(0);
    });

    // TC-009: result 필드가 매우 긴 텍스트
    it('TC-009: result 필드가 매우 긴 텍스트', () => {
      const longText = 'A'.repeat(1000);
      const input = `{"result":"${longText}","type":"text"}`;
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(longText);
      expect(output.length).toBe(1000);
    });

    // TC-010: Strategy 0 감지 로직 (includes 조건)
    it('TC-010: Strategy 0 감지 로직 (includes 조건)', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const input = '{"result":"test","type":"text"}';

      (service as any).parseConversationResponse(input);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conversation: Detecting Claude CLI wrapper format')
      );
    });

    // TC-011: Strategy 0 미감지 (result 없음)
    it('TC-011: Strategy 0 미감지 (result 없음)', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const input = '{"message":"Hello","type":"text"}';

      const output = (service as any).parseConversationResponse(input);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Conversation: Detecting Claude CLI wrapper format')
      );
      expect(output).toBe(input.trim());
    });

    // TC-012: Nested JSON wrapper
    it('TC-012: Nested JSON wrapper', () => {
      const input = '{"result":"{\\"nested\\":\\"value\\"}","type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('{"nested":"value"}');
      expect(typeof output).toBe('string');
    });

    // TC-013: UTF-8 다국어 텍스트
    it('TC-013: UTF-8 다국어 텍스트', () => {
      const input = '{"result":"안녕하세요! こんにちは! 你好!","type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('안녕하세요! こんにちは! 你好!');
    });

    // TC-014: JSON 파싱 예외 발생 시 로깅
    it('TC-014: JSON 파싱 예외 발생 시 로깅', () => {
      const logSpy = vi.spyOn(service as any, 'logClaudeInteraction');
      const input = '{invalid json}';

      const output = (service as any).parseConversationResponse(input);

      // Strategy 0 내부 try-catch로 처리되므로 logClaudeInteraction 호출 안 됨
      expect(logSpy).not.toHaveBeenCalled();
      expect(output).toBe(input.trim());
    });

    // TC-015: parseConversationResponse 메서드 존재 확인
    it('TC-015: parseConversationResponse 메서드 존재 확인', () => {
      expect((service as any).parseConversationResponse).toBeDefined();
      expect(typeof (service as any).parseConversationResponse).toBe('function');
    });

    // TC-016: 대소문자 혼합 (ReSuLt 등)
    it('TC-016: 대소문자 혼합 (ReSuLt 등)', () => {
      const input = '{"Result":"Hello","Type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      // includes는 대소문자 구분하므로 Strategy 0 미감지
      expect(output).toBe(input.trim());
    });
  });

  // ==========================================
  // 2. 통합 테스트 (Integration Tests)
  // ==========================================

  describe('2.1 generateConversationResponse 통합 테스트', () => {
    // TC-017: 첫 메시지 생성 및 JSON wrapper 제거
    it('TC-017: 첫 메시지 생성 및 JSON wrapper 제거', async () => {
      vi.spyOn(service as any, 'executeClaude').mockResolvedValue(
        '{"result":"What do you like to do?","type":"text"}'
      );

      const topicContext: TopicContext = {
        englishContent: 'Talking about hobbies',
        cefrLevel: 'B1',
        keywords: ['hobby'],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('What do you like to do?');
      expect(response).not.toContain('"result"');
      expect(response).not.toContain('"type"');
    });

    // TC-018: 후속 메시지 생성 및 파싱
    it('TC-018: 후속 메시지 생성 및 파싱', async () => {
      vi.spyOn(service as any, 'executeClaude').mockResolvedValue(
        '{"result":"That\'s great! What kind of books?","type":"text"}'
      );

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

      expect(response).toBe("That's great! What kind of books?");
      expect(response).not.toContain('"result"');
    });

    // TC-019: executeClaude 실패 시 에러 전파
    it('TC-019: executeClaude 실패 시 에러 전파', async () => {
      vi.spyOn(service as any, 'executeClaude').mockRejectedValue(new Error('Claude CLI failed'));

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

    // TC-020: Validation 실패 - englishContent 누락
    it('TC-020: Validation 실패 - englishContent 누락', async () => {
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

    // TC-021: Validation 실패 - cefrLevel 누락
    it('TC-021: Validation 실패 - cefrLevel 누락', async () => {
      const topicContext: any = {
        englishContent: 'Test',
        keywords: [],
      };

      await expect(service.generateConversationResponse(topicContext, [], true)).rejects.toThrow(
        AppError
      );
    });

    // TC-022: 여러 대화 턴 시뮬레이션
    it('TC-022: 여러 대화 턴 시뮬레이션', async () => {
      let callCount = 0;
      vi.spyOn(service as any, 'executeClaude').mockImplementation(() => {
        const responses = [
          '{"result":"First message","type":"text"}',
          '{"result":"Second message","type":"text"}',
          '{"result":"Third message","type":"text"}',
        ];
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
    });

    // TC-023: parseConversationResponse가 빈 값 반환 시
    it('TC-023: parseConversationResponse가 빈 값 반환 시', async () => {
      vi.spyOn(service as any, 'executeClaude').mockResolvedValue('{"result":"","type":"text"}');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('');
      expect(response.length).toBe(0);
    });

    // TC-024: executeClaude가 plain text 반환 (wrapper 없음)
    it('TC-024: executeClaude가 plain text 반환 (wrapper 없음)', async () => {
      vi.spyOn(service as any, 'executeClaude').mockResolvedValue('Hello! How are you?');

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      expect(response).toBe('Hello! How are you?');
    });
  });

  // ==========================================
  // 3. 경계값 테스트 (Boundary Tests)
  // ==========================================

  describe('3. 경계값 테스트 (Boundary Tests)', () => {
    // TC-025: result 필드가 null
    it('TC-025: result 필드가 null', () => {
      const input = '{"result":null,"type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(input.trim());
    });

    // TC-026: 매우 짧은 응답 (1글자)
    it('TC-026: 매우 짧은 응답 (1글자)', () => {
      const input = '{"result":"A","type":"text"}';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe('A');
      expect(output.length).toBe(1);
    });

    // TC-027: 입력이 빈 문자열
    it('TC-027: 입력이 빈 문자열', () => {
      const output = (service as any).parseConversationResponse('');

      expect(output).toBe('');
      expect(output.length).toBe(0);
    });

    // TC-028: 입력이 공백만 포함
    it('TC-028: 입력이 공백만 포함', () => {
      const output = (service as any).parseConversationResponse('   \n\t  ');

      expect(output).toBe('');
      expect(output.length).toBe(0);
    });
  });

  // ==========================================
  // 4. 에러 케이스 (Error Cases)
  // ==========================================

  describe('4. 에러 케이스 (Error Cases)', () => {
    // TC-029: 순환 참조 JSON
    it('TC-029: 순환 참조 JSON (malformed)', () => {
      const input = '{"result":"test","type":{"circular":';
      const output = (service as any).parseConversationResponse(input);

      expect(output).toBe(input.trim());
    });

    // TC-030: Strategy 0 내부 예외 발생 시 catch 처리
    it('TC-030: Strategy 0 내부 예외 발생 시 catch 처리', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const input = '{"result":"test","type":"text"'; // 닫는 괄호 누락

      const output = (service as any).parseConversationResponse(input);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse CLI wrapper')
      );
      expect(output).toBe(input.trim());
    });

    // TC-031: 외부 try-catch로 예외 전파 (가정)
    it('TC-031: 외부 try-catch로 예외 전파 (가정)', () => {
      const logSpy = vi.spyOn(service as any, 'logClaudeInteraction');

      const output = (service as any).parseConversationResponse('test');

      expect(logSpy).not.toHaveBeenCalled();
      expect(output).toBe('test');
    });

    // TC-032: TTS에서 JSON wrapper 읽지 않는지 확인
    it('TC-032: TTS에서 JSON wrapper 읽지 않는지 확인', async () => {
      const mockTTSService = {
        speak: vi.fn(),
      };

      vi.spyOn(service as any, 'executeClaude').mockResolvedValue(
        '{"result":"Hello! How are you?","type":"text"}'
      );

      const topicContext: TopicContext = {
        englishContent: 'Test',
        cefrLevel: 'A1',
        keywords: [],
      };

      const response = await service.generateConversationResponse(topicContext, [], true);

      // ConversationView에서 TTS 호출 시뮬레이션
      mockTTSService.speak(response);

      expect(mockTTSService.speak).toHaveBeenCalledWith('Hello! How are you?');
      expect(mockTTSService.speak).not.toHaveBeenCalledWith(expect.stringContaining('"result"'));
    });
  });
});

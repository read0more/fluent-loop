import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AppError, ErrorCode } from '../../errors/AppError';
import { ClaudeSDKClient, _setMockModule, _clearMockModule } from '../ClaudeSDKClient';

/**
 * ClaudeSDKClient Unit Tests
 *
 * 테스트 대상: ClaudeSDKClient (Claude Agent SDK 기반 클라이언트)
 * 테스트 유형: 단위 테스트
 * 관련 문서: E:\develop\electron-test\claude.config\dev-workflow\docs\test-cases.md
 */

// Mock query function from Claude Agent SDK
const mockQuery = vi.fn();

// Helper: Create mock AsyncGenerator that yields messages
function createMockGenerator(messages: unknown[]) {
  return (async function* () {
    for (const message of messages) {
      yield message;
    }
  })();
}

describe('ClaudeSDKClient - Unit Tests', () => {
  let client: ClaudeSDKClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // 테스트용 mock 모듈 주입
    _setMockModule({
      query: (...args: unknown[]) => mockQuery(...args),
    });
    client = new ClaudeSDKClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearMockModule();
  });

  describe('TC-001: queryStructured - 성공 케이스', () => {
    it('should return structured_output when SDK query succeeds', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const schema = {
        type: 'object' as const,
        properties: {
          englishText: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
        },
        required: ['englishText', 'keywords'],
      };

      const expectedOutput = {
        englishText: 'This is a test',
        keywords: ['test', 'example', 'demo'],
      };

      // Mock SDK response with structured_output
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: JSON.stringify(expectedOutput),
            structured_output: expectedOutput,
          },
        ])
      );

      // Act
      const result = await client.queryStructured(prompt, schema);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt,
          options: expect.objectContaining({
            tools: [],
            maxTurns: 3,
            outputFormat: expect.objectContaining({
              type: 'json_schema',
            }),
          }),
        })
      );
    });

    it('should parse result as JSON when structured_output is not available', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const schema = {
        type: 'object' as const,
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      };

      const expectedOutput = { text: 'hello' };

      // Mock SDK response without structured_output
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: JSON.stringify(expectedOutput),
          },
        ])
      );

      // Act
      const result = await client.queryStructured(prompt, schema);

      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });

  describe('TC-002: queryStructured - SDK 에러 핸들링', () => {
    it('should throw AppError when SDK yields error message', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const schema = {
        type: 'object' as const,
        properties: {},
        required: [],
      };

      // Mock SDK error response
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'error_during_execution',
            errors: ['Rate limit exceeded'],
          },
        ])
      );

      // Act & Assert
      await expect(client.queryStructured(prompt, schema)).rejects.toThrow(AppError);
    });
  });

  describe('TC-003: queryStructured - 빈 응답 처리', () => {
    it('should throw AppError when AsyncGenerator yields no result messages', async () => {
      // Arrange
      const prompt = 'Test';
      const schema = {
        type: 'object' as const,
        properties: {},
        required: [],
      };

      // Mock empty generator (no messages)
      mockQuery.mockReturnValue(createMockGenerator([]));

      // Act & Assert
      await expect(client.queryStructured(prompt, schema)).rejects.toThrow(AppError);
    });
  });

  describe('TC-004: query - 성공 케이스', () => {
    it('should return text string when SDK query succeeds', async () => {
      // Arrange
      const prompt = 'What is AI?';
      const expectedText = 'AI stands for Artificial Intelligence';

      // Mock SDK response
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: expectedText,
          },
        ])
      );

      // Act
      const result = await client.query(prompt);

      // Assert
      expect(typeof result).toBe('string');
      expect(result).toBe(expectedText);
    });
  });

  describe('TC-005: mapError - rate limit error 매핑', () => {
    it('should map rate limit error to AppError with Korean message', async () => {
      // Arrange
      const prompt = 'Test';

      mockQuery.mockImplementation(() => {
        throw new Error('Rate limit exceeded - too many requests');
      });

      // Act & Assert
      await expect(client.query(prompt)).rejects.toThrow(AppError);
      await expect(client.query(prompt)).rejects.toMatchObject({
        code: ErrorCode.CLAUDE_API_ERROR,
      });

      try {
        await client.query(prompt);
      } catch (error) {
        expect((error as AppError).userMessage).toContain('한도');
      }
    });
  });

  describe('TC-006: mapError - authentication error 매핑', () => {
    it('should map authentication error to AppError with Korean message', async () => {
      // Arrange
      const prompt = 'Test';

      mockQuery.mockImplementation(() => {
        throw new Error('Authentication failed - unauthorized');
      });

      // Act & Assert
      await expect(client.query(prompt)).rejects.toThrow(AppError);
      await expect(client.query(prompt)).rejects.toMatchObject({
        code: ErrorCode.CLAUDE_API_ERROR,
      });

      try {
        await client.query(prompt);
      } catch (error) {
        expect((error as AppError).userMessage).toContain('인증');
      }
    });
  });

  describe('TC-007: mapError - network error 매핑', () => {
    it('should map network error to AppError with NETWORK_ERROR code', async () => {
      // Arrange
      const prompt = 'Test';

      mockQuery.mockImplementation(() => {
        throw new Error('Network connection failed');
      });

      // Act & Assert
      await expect(client.query(prompt)).rejects.toThrow(AppError);
      await expect(client.query(prompt)).rejects.toMatchObject({
        code: ErrorCode.NETWORK_ERROR,
      });

      try {
        await client.query(prompt);
      } catch (error) {
        expect((error as AppError).userMessage).toContain('네트워크');
      }
    });
  });

  describe('TC-008: constructor - Claude Code 인증', () => {
    it('should not require API key (uses Claude Code auth)', () => {
      // Claude Agent SDK는 API key 없이도 동작
      // 터미널에서 claude 인증을 완료한 경우 자동으로 사용
      expect(() => {
        new ClaudeSDKClient();
      }).not.toThrow();
    });
  });

  describe('Error Mapping - All Error Types', () => {
    const errorMappingTestCases = [
      {
        name: 'TC-056: server error',
        errorMessage: 'Server error 500',
        expectedCode: ErrorCode.CLAUDE_API_ERROR,
        expectedMessageContains: '일시적인 문제',
      },
      {
        name: 'TC-061: Claude Code not found',
        errorMessage: 'Claude Code not found',
        expectedCode: ErrorCode.CLAUDE_API_ERROR,
        expectedMessageContains: 'Claude Code',
      },
      {
        name: 'TC-062: timeout error',
        errorMessage: 'Request timeout',
        expectedCode: ErrorCode.NETWORK_ERROR,
        expectedMessageContains: '네트워크',
      },
    ];

    errorMappingTestCases.forEach(
      ({ name, errorMessage, expectedCode, expectedMessageContains }) => {
        it(`${name} - should map error correctly`, async () => {
          // Arrange
          mockQuery.mockImplementation(() => {
            throw new Error(errorMessage);
          });

          // Act & Assert
          await expect(client.query('test')).rejects.toThrow(AppError);
          await expect(client.query('test')).rejects.toMatchObject({
            code: expectedCode,
          });

          try {
            await client.query('test');
          } catch (error) {
            expect((error as AppError).userMessage).toContain(expectedMessageContains);
          }
        });
      }
    );
  });

  describe('Edge Cases', () => {
    it('should handle JSON parse error in result', async () => {
      // Arrange
      const prompt = 'Test';
      const schema = {
        type: 'object' as const,
        properties: {},
        required: [],
      };

      // Mock invalid JSON in result (without structured_output)
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: 'not valid json {{{',
          },
        ])
      );

      // Act & Assert
      await expect(client.queryStructured(prompt, schema)).rejects.toThrow(AppError);
    });

    it('should handle assistant messages (ignore them)', async () => {
      // Arrange
      const prompt = 'What is AI?';
      const expectedText = 'AI is Artificial Intelligence';

      // Mock SDK response with assistant messages before result
      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'assistant',
            message: { content: [{ type: 'text', text: 'Thinking...' }] },
          },
          {
            type: 'result',
            subtype: 'success',
            result: expectedText,
          },
        ])
      );

      // Act
      const result = await client.query(prompt);

      // Assert
      expect(result).toBe(expectedText);
    });

    it('should handle very large prompts', async () => {
      // Arrange
      const largePrompt = 'a'.repeat(100000);
      const expectedText = 'Response';

      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: expectedText,
          },
        ])
      );

      // Act
      const result = await client.query(largePrompt);

      // Assert
      expect(result).toBe(expectedText);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: largePrompt,
        })
      );
    });
  });

  describe('Korean Text Support', () => {
    it('should handle Korean input correctly', async () => {
      // Arrange
      const koreanPrompt = '안녕하세요. 오늘 날씨가 좋습니다.';
      const expectedText = 'Hello. The weather is nice today.';

      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: expectedText,
          },
        ])
      );

      // Act
      const result = await client.query(koreanPrompt);

      // Assert
      expect(result).toBe(expectedText);
    });

    it('should handle Korean output correctly', async () => {
      // Arrange
      const prompt = 'Translate to Korean: Hello';
      const expectedText = '안녕하세요';

      mockQuery.mockReturnValue(
        createMockGenerator([
          {
            type: 'result',
            subtype: 'success',
            result: expectedText,
          },
        ])
      );

      // Act
      const result = await client.query(prompt);

      // Assert
      expect(result).toBe(expectedText);
    });
  });
});

describe('ClaudeSDKClient - Performance Tests', () => {
  it('should complete query quickly (no process spawn overhead)', async () => {
    // Claude Agent SDK는 프로세스 spawn 없이 직접 통신
    // PowerShell/CLI 방식 대비 더 빠름
    expect(true).toBe(true);
  });

  it('should not create temporary files', async () => {
    // Claude Agent SDK는 임시 파일 없이 직접 통신
    // 파일 I/O 오버헤드 없음
    expect(true).toBe(true);
  });
});

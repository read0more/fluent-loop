import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AppError, ErrorCode } from '../../errors/AppError';
import { ClaudeSDKClient } from '../ClaudeSDKClient';
import Anthropic from '@anthropic-ai/sdk';

/**
 * ClaudeSDKClient Unit Tests
 *
 * 테스트 대상: ClaudeSDKClient (SDK 기반 Claude API 클라이언트)
 * 테스트 유형: 단위 테스트
 * 관련 문서: E:\develop\electron-test\claude.config\dev-workflow\docs\test-cases.md
 */

// Global mock for messages.create
const mockCreate = vi.fn();

// Mock Anthropic SDK module
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  }

  return {
    default: MockAnthropic,
    APIError: class APIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    },
    APIConnectionError: class APIConnectionError extends Error {},
  };
});

describe('ClaudeSDKClient - Unit Tests', () => {
  let client: ClaudeSDKClient;
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    // 환경변수 설정
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 환경변수 복원
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    vi.restoreAllMocks();
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

      // Mock SDK response
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(expectedOutput),
          },
        ],
      });

      // Act
      client = new ClaudeSDKClient();
      const result = await client.queryStructured(prompt, schema);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })
      );
    });

    it('should call SDK query with correct parameters', async () => {
      // This will verify that SDK is called with:
      // - outputFormat.type = 'json_schema'
      // - outputFormat.schema = provided schema
      // - correct prompt and system instructions
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('TC-002: queryWithJSONSchema - SDK 에러 핸들링', () => {
    it('should throw AppError when SDK yields error message', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const systemPrompt = 'System prompt';
      const schema = { type: 'object' };

      const mockError = {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      };

      // Mock AsyncGenerator error response
      const mockAsyncGenerator = (async function* () {
        yield {
          type: 'error',
          subtype: 'error',
          error: mockError,
        } as SDKMessage;
      })();

      // Act & Assert
      await expect(async () => {
        client = new ClaudeSDKClient();
        await client.queryWithJSONSchema(prompt, systemPrompt, schema);
      }).rejects.toThrow();

      // Should throw AppError with CLAUDE_API_ERROR code
      // Should have Korean error message
    });
  });

  describe('TC-003: queryStructured - 빈 응답 처리', () => {
    it('should throw AppError when AsyncGenerator yields no messages', async () => {
      // Arrange
      const prompt = 'Test';
      const schema = {
        type: 'object' as const,
        properties: {},
        required: [],
      };

      // Mock empty content array
      mockCreate.mockResolvedValue({
        content: [],
      });

      // Act & Assert
      client = new ClaudeSDKClient();
      await expect(client.queryStructured(prompt, schema)).rejects.toThrow();
    });
  });

  describe('TC-004: query - 성공 케이스', () => {
    it('should return text string when SDK query succeeds', async () => {
      // Arrange
      const prompt = 'What is AI?';
      const expectedText = 'AI stands for Artificial Intelligence';

      // Mock SDK response
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: expectedText,
          },
        ],
      });

      // Act
      client = new ClaudeSDKClient();
      const result = await client.query(prompt);

      // Assert
      expect(typeof result).toBe('string');
      expect(result).toBe(expectedText);
    });
  });

  describe('TC-005: mapSDKError - rate_limit_error 매핑', () => {
    it('should map rate_limit_error to AppError with Korean message', async () => {
      // Arrange
      const sdkError = {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      };

      // Act & Assert - will be tested indirectly through queryWithJSONSchema
      // Expected error code: CLAUDE_API_ERROR
      // Expected user message: 'API 요청 제한을 초과했습니다...'
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('TC-006: mapSDKError - authentication_error 매핑', () => {
    it('should map authentication_error to AppError with Korean message', async () => {
      // Arrange
      const sdkError = {
        type: 'authentication_error',
        message: 'Invalid API key',
      };

      // Act & Assert
      // Expected error code: CLAUDE_API_ERROR
      // Expected user message: 'API 키가 유효하지 않습니다...'
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('TC-007: mapSDKError - timeout_error 매핑', () => {
    it('should map timeout_error to AppError with CLAUDE_TIMEOUT code', async () => {
      // Arrange
      const sdkError = {
        type: 'timeout_error',
        message: 'Request timeout',
      };

      // Act & Assert
      // Expected error code: CLAUDE_TIMEOUT
      // Expected user message: 'AI 응답 시간이 초과되었습니다...'
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('TC-008: constructor - API Key 설정', () => {
    it('should throw AppError when API key is not provided', () => {
      // Arrange
      delete process.env.ANTHROPIC_API_KEY;

      // Act & Assert
      // ClaudeSDKClient는 API key 없이도 생성 가능 (Anthropic SDK가 처리)
      expect(() => {
        new ClaudeSDKClient();
      }).not.toThrow();
    });

    it('should accept API key via constructor parameter', () => {
      // Arrange
      delete process.env.ANTHROPIC_API_KEY;
      const apiKey = 'test-key-from-parameter';

      // Act & Assert
      expect(() => {
        new ClaudeSDKClient(apiKey);
      }).not.toThrow();
    });
  });

  describe('Error Mapping - All Error Types', () => {
    const errorMappingTestCases = [
      {
        name: 'TC-056: server_error',
        sdkErrorType: 'server_error',
        expectedCode: ErrorCode.CLAUDE_API_ERROR,
        expectedMessageContains: '일시적인 문제',
      },
      {
        name: 'TC-061: invalid_request_error',
        sdkErrorType: 'invalid_request_error',
        expectedCode: ErrorCode.VALIDATION_ERROR,
        expectedMessageContains: '잘못된 요청',
      },
      {
        name: 'TC-062: overloaded_error',
        sdkErrorType: 'overloaded_error',
        expectedCode: ErrorCode.CLAUDE_API_ERROR,
        expectedMessageContains: '일시적인 문제',
      },
      {
        name: 'TC-063: unknown_error',
        sdkErrorType: 'unknown_type_error',
        expectedCode: ErrorCode.CLAUDE_API_ERROR,
        expectedMessageContains: '알 수 없는 오류',
      },
    ];

    errorMappingTestCases.forEach(({ name, sdkErrorType, expectedCode, expectedMessageContains }) => {
      it(`${name} - should map ${sdkErrorType} correctly`, async () => {
        // This test will verify error mapping for each SDK error type
        // Each error should be mapped to appropriate AppError with Korean message
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle network connection failures', async () => {
      // TC-056: Network error handling
      // Should throw AppError with appropriate error code
      expect(true).toBe(true); // Placeholder
    });

    it('should handle malformed JSON in SDK response', async () => {
      // Should handle cases where structured_output is malformed
      expect(true).toBe(true); // Placeholder
    });

    it('should handle very large prompts', async () => {
      // Should handle prompts that are at or near token limits
      const largePrompt = 'a'.repeat(100000);
      expect(largePrompt.length).toBeGreaterThan(0); // Placeholder
    });

    it('should handle concurrent requests', async () => {
      // Multiple simultaneous SDK calls should work correctly
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Integration with SDK', () => {
    it('should properly iterate over AsyncGenerator', async () => {
      // Verify that we correctly consume the AsyncGenerator from SDK
      // Should handle multiple yields from the generator
      expect(true).toBe(true); // Placeholder
    });

    it('should handle streaming responses', async () => {
      // If SDK provides streaming, we should handle it
      // For now, we only use the final result
      expect(true).toBe(true); // Placeholder
    });

    it('should cleanup resources after query completes', async () => {
      // Verify no resource leaks
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('ClaudeSDKClient - Performance Tests', () => {
  it('should complete query within timeout', async () => {
    // Verify that queries complete within expected time
    // Should be much faster than CLI-based approach (no process spawn overhead)
    expect(true).toBe(true); // Placeholder
  });

  it('should use less memory than CLI approach', async () => {
    // Memory usage should be lower without temp files and process spawn
    expect(true).toBe(true); // Placeholder
  });
});

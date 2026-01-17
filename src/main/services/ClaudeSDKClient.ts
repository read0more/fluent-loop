import Anthropic from '@anthropic-ai/sdk';
import { AppError, ErrorCode } from '../errors/AppError';

/**
 * Claude SDK 클라이언트 래퍼
 * Anthropic SDK를 사용하여 Claude API와 통신
 */
export class ClaudeSDKClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    // API Key는 환경변수에서 자동으로 로드 (ANTHROPIC_API_KEY)
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Claude API 호출 (텍스트 응답)
   */
  async query(prompt: string, options?: { maxTokens?: number }): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: options?.maxTokens || 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 응답 추출
      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      console.error('[ClaudeSDKClient] API call failed:', error);
      throw this.mapError(error);
    }
  }

  /**
   * Claude API 호출 (JSON Schema 기반 structured output)
   * @param prompt 프롬프트
   * @param schema JSON Schema 객체
   */
  async queryStructured<T = unknown>(
    prompt: string,
    schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    },
    options?: { maxTokens?: number }
  ): Promise<T> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: options?.maxTokens || 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        // @ts-expect-error - SDK 타입이 아직 완전하지 않을 수 있음
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            strict: true,
            schema,
          },
        },
      });

      // 응답 추출
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text) as T;
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      console.error('[ClaudeSDKClient] Structured API call failed:', error);
      throw this.mapError(error);
    }
  }

  /**
   * SDK 에러를 AppError로 매핑
   */
  private mapError(error: unknown): AppError {
    if (error instanceof Anthropic.APIError) {
      // Anthropic API 에러
      if (error.status === 401) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Invalid API key',
          'Claude API 키가 유효하지 않습니다.',
          error
        );
      }

      if (error.status === 429) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Rate limit exceeded',
          'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          error
        );
      }

      if (error.status === 500 || error.status === 502 || error.status === 503) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Claude API server error',
          'Claude API 서버에 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
          error
        );
      }

      return new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        `Claude API error: ${error.message}`,
        'Claude API 호출 중 오류가 발생했습니다.',
        error
      );
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to connect to Claude API',
        '네트워크 연결을 확인해주세요.',
        error as Error
      );
    }

    if (error instanceof SyntaxError) {
      return new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse Claude response',
        'AI 응답 파싱에 실패했습니다.',
        error
      );
    }

    // 기타 에러
    return new AppError(
      ErrorCode.CLAUDE_API_ERROR,
      'Unknown Claude SDK error',
      'AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
      error as Error
    );
  }
}

import { AppError, ErrorCode } from '../errors/AppError';

// 테스트 환경에서 사용할 모듈 캐시 (vi.mock에서 주입)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockModule: any = null;

/**
 * 테스트에서 모듈을 주입할 수 있도록 하는 함수
 * @internal 테스트 전용
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _setMockModule(module: any): void {
  mockModule = module;
}

/**
 * 테스트에서 모듈 초기화
 * @internal 테스트 전용
 */
export function _clearMockModule(): void {
  mockModule = null;
}

// ESM 모듈을 동적으로 import하기 위한 헬퍼
// TypeScript가 import()를 require()로 변환하지 못하도록 Function 생성자 사용
async function getQueryFunction(): Promise<typeof import('@anthropic-ai/claude-agent-sdk').query> {
  // 테스트 환경에서는 주입된 mock 사용
  if (mockModule) {
    return mockModule.query;
  }

  const importFn = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
  const module = await importFn('@anthropic-ai/claude-agent-sdk');
  return module.query;
}

/**
 * Claude Agent SDK 클라이언트 래퍼
 * Claude Code 인증을 자동으로 사용 (터미널에서 `claude` 실행하여 인증 완료 필요)
 * API Key 불필요
 */
export class ClaudeSDKClient {
  /**
   * Claude API 호출 (텍스트 응답)
   * @param prompt 프롬프트
   * @param options 추가 옵션
   */
  async query(prompt: string, _options?: { maxTokens?: number }): Promise<string> {
    try {
      const query = await getQueryFunction();
      let result = '';

      // Claude Agent SDK의 query() 함수 사용
      // AsyncGenerator를 순회하여 결과 수집
      for await (const message of query({
        prompt,
        options: {
          // 도구 없이 순수 텍스트 응답만 받음
          tools: [],
          // 단일 턴으로 제한
          maxTurns: 1,
        },
      })) {
        // 결과 메시지에서 응답 추출
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            result = message.result;
          } else {
            // 에러 메시지 추출 로직 개선
            let errorMessage = 'Unknown error';
            if ('errors' in message && Array.isArray(message.errors) && message.errors.length > 0) {
              errorMessage = message.errors.join(', ');
            } else if ('error' in message && message.error) {
              errorMessage = String(message.error);
            } else if ('message' in message && message.message) {
              errorMessage = String(message.message);
            } else {
              // 디버깅을 위해 전체 메시지 로깅
              console.error(
                '[ClaudeSDKClient] Unknown error structure:',
                JSON.stringify(message, null, 2)
              );
              errorMessage = `Unknown error (subtype: ${message.subtype || 'unknown'})`;
            }
            throw new Error(`Claude Agent SDK error: ${errorMessage}`);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('[ClaudeSDKClient] API call failed:', error);
      throw this.mapError(error);
    }
  }

  /**
   * Claude API 호출 (JSON Schema 기반 structured output)
   * @param prompt 프롬프트
   * @param schema JSON Schema 객체
   * @param options 추가 옵션
   */
  async queryStructured<T = unknown>(
    prompt: string,
    schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    },
    _options?: { maxTokens?: number }
  ): Promise<T> {
    try {
      const query = await getQueryFunction();
      let result: T | undefined;

      // Claude Agent SDK의 query() 함수 사용 (structured output)
      for await (const message of query({
        prompt,
        options: {
          // 도구 없이 순수 응답만 받음
          tools: [],
          // JSON Schema structured output에서 스키마 검증을 위한 여유 제공
          // 실패 시에도 SDK가 재시도할 수 있도록 충분한 턴 제공
          maxTurns: 3,
          // JSON Schema 기반 structured output
          outputFormat: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: schema.properties,
              required: schema.required,
            },
          },
        },
      })) {
        // 결과 메시지에서 structured_output 추출
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            // structured_output이 있으면 사용, 없으면 result를 파싱
            if ('structured_output' in message && message.structured_output) {
              result = message.structured_output as T;
            } else if (message.result) {
              result = JSON.parse(message.result) as T;
            }
          } else {
            // 에러 메시지 추출 로직 개선
            let errorMessage = 'Unknown error';
            if ('errors' in message && Array.isArray(message.errors) && message.errors.length > 0) {
              errorMessage = message.errors.join(', ');
            } else if ('error' in message && message.error) {
              errorMessage = String(message.error);
            } else if ('message' in message && message.message) {
              errorMessage = String(message.message);
            } else {
              // 디버깅을 위해 전체 메시지 로깅
              console.error(
                '[ClaudeSDKClient] Unknown error structure:',
                JSON.stringify(message, null, 2)
              );
              errorMessage = `Unknown error (subtype: ${message.subtype || 'unknown'})`;
            }
            throw new Error(`Claude Agent SDK error: ${errorMessage}`);
          }
        }
      }

      if (result === undefined) {
        throw new Error('No result received from Claude Agent SDK');
      }

      return result;
    } catch (error) {
      console.error('[ClaudeSDKClient] Structured API call failed:', error);
      throw this.mapError(error);
    }
  }

  /**
   * SDK 에러를 AppError로 매핑
   */
  private mapError(error: unknown): AppError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Claude Code not found 에러
      if (message.includes('claude code not found') || message.includes('not found')) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Claude Code not installed',
          'Claude Code가 설치되어 있지 않습니다. 터미널에서 claude를 실행하여 설치 및 인증해주세요.',
          error
        );
      }

      // 인증 에러
      if (
        message.includes('authentication') ||
        message.includes('api key') ||
        message.includes('unauthorized')
      ) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Authentication failed',
          '인증에 실패했습니다. 터미널에서 claude를 실행하여 인증을 완료해주세요.',
          error
        );
      }

      // Rate limit 에러
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Rate limit exceeded',
          'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          error
        );
      }

      // Max turns 에러 (structured output 스키마 검증 시 발생 가능)
      if (
        message.includes('error_max_turns') ||
        message.includes('max_turns') ||
        message.includes('maxturns')
      ) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Max turns exceeded',
          'AI 응답 생성 중 최대 턴 수를 초과했습니다. 다시 시도해주세요.',
          error
        );
      }

      // 서버 에러
      if (
        message.includes('server error') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503')
      ) {
        return new AppError(
          ErrorCode.CLAUDE_API_ERROR,
          'Claude API server error',
          'Claude API 서버에 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
          error
        );
      }

      // 네트워크 에러
      if (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('timeout')
      ) {
        return new AppError(
          ErrorCode.NETWORK_ERROR,
          'Failed to connect to Claude API',
          '네트워크 연결을 확인해주세요.',
          error
        );
      }

      // JSON 파싱 에러
      if (error instanceof SyntaxError) {
        return new AppError(
          ErrorCode.CLAUDE_PARSING_ERROR,
          'Failed to parse Claude response',
          'AI 응답 파싱에 실패했습니다.',
          error
        );
      }

      // 일반 에러
      return new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        error.message,
        'AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
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

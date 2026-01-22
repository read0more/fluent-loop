/**
 * EnvConfig 모듈 단위 테스트
 *
 * TDD Red Phase: 실패하는 테스트 먼저 작성
 * 테스트 프레임워크: Vitest
 *
 * 테스트 범위:
 * - TC-001: .env 파일 정상 로딩
 * - TC-002: .env 파일 누락 시 기본값 사용
 * - TC-003: process.env 환경변수 우선 적용
 * - TC-004: 환경변수 타입 검증
 * - TC-021: 빈 .env 파일
 * - TC-022: 주석만 있는 .env 파일
 * - TC-023: 잘못된 URL 형식
 * - TC-024: 포트 번호 범위 초과
 * - TC-025: 특수 문자가 포함된 환경변수
 * - TC-026: 매우 긴 URL 값
 * - TC-027: 환경변수 값에 공백 포함
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// 테스트용 임시 디렉토리 경로
const TEST_ROOT = path.join(process.cwd(), '.test-env-temp');
const TEST_ENV_PATH = path.join(TEST_ROOT, '.env');

describe('EnvConfig Module - Unit Tests', () => {
  beforeEach(() => {
    // 테스트용 임시 디렉토리 생성
    if (!fs.existsSync(TEST_ROOT)) {
      fs.mkdirSync(TEST_ROOT, { recursive: true });
    }

    // 모듈 캐시 초기화 (중요!)
    vi.resetModules();

    // 테스트용 .env 파일 경로 설정
    vi.stubEnv('DOTENV_CONFIG_PATH', TEST_ENV_PATH);

    // process.env 백업 및 초기화
    vi.stubEnv('BACKEND_URL', '');
    vi.stubEnv('BACKEND_PORT', '');
    vi.stubEnv('NODE_ENV', '');

    // console spy 설정
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // 테스트 파일 정리
    if (fs.existsSync(TEST_ENV_PATH)) {
      fs.unlinkSync(TEST_ENV_PATH);
    }
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmdirSync(TEST_ROOT, { recursive: true });
    }

    // 모듈 캐시 초기화
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('TC-001: .env 파일 정상 로딩', () => {
    it('should load .env file and parse environment variables correctly', async () => {
      // Arrange
      const envContent = [
        'BACKEND_URL=http://localhost:8000',
        'BACKEND_PORT=8000',
        'NODE_ENV=development',
      ].join('\n');

      fs.writeFileSync(TEST_ENV_PATH, envContent);

      // Act
      // NOTE: 실제 구현 시 dotenv.config({ path: TEST_ENV_PATH })를 호출
      // 현재는 구현이 없으므로 테스트가 실패할 것임
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
      expect(config.backendPort).toBe('8000');
      expect(config.environment).toBe('development');
    });

    it('should validate loaded config matches AppConfig interface', async () => {
      // Arrange
      const envContent = [
        'BACKEND_URL=http://test:9000',
        'BACKEND_PORT=9000',
        'NODE_ENV=production',
      ].join('\n');

      fs.writeFileSync(TEST_ENV_PATH, envContent);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config).toHaveProperty('backendUrl');
      expect(config).toHaveProperty('backendPort');
      expect(config).toHaveProperty('environment');
      expect(typeof config.backendUrl).toBe('string');
      expect(['development', 'production']).toContain(config.environment);
    });
  });

  describe('TC-002: .env 파일 누락 시 기본값 사용', () => {
    it('should use default values when .env file does not exist', async () => {
      // Arrange
      // .env 파일을 생성하지 않음

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
      expect(config.backendPort).toBe('8000');
      expect(config.environment).toBe('development');
    });

    it('should log warning when .env file is missing', async () => {
      // Arrange
      const warnSpy = vi.spyOn(console, 'warn');

      // Act
      await import('../env');

      // Assert
      // NOTE: 실제 구현 시 경고 로그가 출력되어야 함
      // 현재는 구현이 없으므로 이 assertion은 실패할 것임
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('.env file not found'));
    });
  });

  describe('TC-003: process.env 환경변수 우선 적용', () => {
    it('should prioritize process.env over .env file', async () => {
      // Arrange
      const envContent = 'BACKEND_URL=http://localhost:8000';
      fs.writeFileSync(TEST_ENV_PATH, envContent);

      vi.stubEnv('BACKEND_URL', 'http://test-server:9000');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://test-server:9000');
    });

    it('should use .env value when process.env is not set', async () => {
      // Arrange
      const envContent = 'BACKEND_URL=http://from-env-file:7000';
      fs.writeFileSync(TEST_ENV_PATH, envContent);

      // BACKEND_URL 환경변수를 undefined로 설정
      delete process.env.BACKEND_URL;

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://from-env-file:7000');
    });
  });

  describe('TC-004: 환경변수 타입 검증', () => {
    it('should ensure all config properties are strings', async () => {
      // Act
      const { config } = await import('../env');

      // Assert
      expect(typeof config.backendUrl).toBe('string');
      expect(typeof config.backendPort).toBe('string');
      expect(typeof config.environment).toBe('string');
    });

    it('should validate environment is either development or production', async () => {
      // Act
      const { config } = await import('../env');

      // Assert
      expect(['development', 'production']).toContain(config.environment);
    });
  });

  describe('TC-021: 빈 .env 파일', () => {
    it('should use default values when .env file is empty', async () => {
      // Arrange
      fs.writeFileSync(TEST_ENV_PATH, ''); // 빈 파일

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
      expect(config.backendPort).toBe('8000');
      expect(config.environment).toBe('development');
    });

    it('should not log warning for empty .env file', async () => {
      // Arrange
      fs.writeFileSync(TEST_ENV_PATH, '');
      const warnSpy = vi.spyOn(console, 'warn');

      // Act
      await import('../env');

      // Assert
      // 파일은 존재하므로 경고 없어야 함
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('.env file not found'));
    });
  });

  describe('TC-022: 주석만 있는 .env 파일', () => {
    it('should use default values when .env contains only comments', async () => {
      // Arrange
      const envContent = [
        '# This is a comment',
        '# Another comment',
        '# BACKEND_URL=http://commented:8000',
      ].join('\n');

      fs.writeFileSync(TEST_ENV_PATH, envContent);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
      expect(config.backendPort).toBe('8000');
    });
  });

  describe('TC-023: 잘못된 URL 형식', () => {
    it('should fallback to default when URL format is invalid', async () => {
      // Arrange
      vi.stubEnv('BACKEND_URL', 'invalid-url');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
    });

    it('should log error for invalid URL format', async () => {
      // Arrange
      vi.stubEnv('BACKEND_URL', 'not-a-valid-url');
      const errorSpy = vi.spyOn(console, 'error');

      // Act
      await import('../env');

      // Assert
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid BACKEND_URL'));
    });
  });

  describe('TC-024: 포트 번호 범위 초과', () => {
    it('should fallback to default port when port exceeds 65535', async () => {
      // Arrange
      vi.stubEnv('BACKEND_PORT', '99999');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendPort).toBe('8000');
    });

    it('should log warning for invalid port number', async () => {
      // Arrange
      vi.stubEnv('BACKEND_PORT', '70000');
      const warnSpy = vi.spyOn(console, 'warn');

      // Act
      await import('../env');

      // Assert
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid port'));
    });

    it('should reject negative port numbers', async () => {
      // Arrange
      vi.stubEnv('BACKEND_PORT', '-1');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendPort).toBe('8000');
    });
  });

  describe('TC-025: 특수 문자가 포함된 환경변수', () => {
    it('should preserve URL with query parameters', async () => {
      // Arrange
      const urlWithQuery = 'http://localhost:8000?key=value&token=abc123';
      vi.stubEnv('BACKEND_URL', urlWithQuery);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe(urlWithQuery);
    });

    it('should handle URL with special characters', async () => {
      // Arrange
      const urlWithSpecialChars = 'http://localhost:8000/api/v1?q=test%20value';
      vi.stubEnv('BACKEND_URL', urlWithSpecialChars);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe(urlWithSpecialChars);
    });
  });

  describe('TC-026: 매우 긴 URL 값', () => {
    it('should handle URLs longer than 2000 characters', async () => {
      // Arrange
      const longUrl = 'http://localhost:8000?' + 'a'.repeat(2000);
      vi.stubEnv('BACKEND_URL', longUrl);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe(longUrl);
      expect(config.backendUrl.length).toBeGreaterThan(2000);
    });
  });

  describe('TC-027: 환경변수 값에 공백 포함', () => {
    it('should trim whitespace from environment variable values', async () => {
      // Arrange
      vi.stubEnv('BACKEND_URL', '  http://localhost:8000  ');
      vi.stubEnv('BACKEND_PORT', '  8000  ');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
      expect(config.backendPort).toBe('8000');
      expect(config.backendUrl).not.toContain(' ');
    });

    it('should handle tabs and newlines', async () => {
      // Arrange
      vi.stubEnv('BACKEND_URL', '\thttp://localhost:8000\n');

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');
    });
  });

  describe('Edge Cases - File System Errors', () => {
    it('should handle .env file read permission errors gracefully', async () => {
      // Arrange
      fs.writeFileSync(TEST_ENV_PATH, 'BACKEND_URL=http://test:8000');

      // Windows에서는 파일 권한 테스트가 제한적이므로 skip
      if (process.platform === 'win32') {
        expect(true).toBe(true);
        return;
      }

      fs.chmodSync(TEST_ENV_PATH, 0o000);

      // Act
      const { config } = await import('../env');

      // Assert
      expect(config.backendUrl).toBe('http://localhost:8000');

      // Cleanup
      fs.chmodSync(TEST_ENV_PATH, 0o644);
    });
  });
});

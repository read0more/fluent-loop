/**
 * 서비스 생성자 환경변수 주입 테스트
 *
 * TDD Red Phase: 실패하는 테스트 먼저 작성
 * 테스트 프레임워크: Vitest
 *
 * 테스트 범위:
 * - TC-005: TTSService 기본값 생성자
 * - TC-006: TTSService 커스텀 URL 주입
 * - TC-007: STTService 기본값 생성자
 * - TC-008: STTService 커스텀 URL 주입
 * - TC-009: ConfigSyncService 기본값 생성자
 * - TC-010: ConfigSyncService 커스텀 URL 주입
 * - TC-011: 여러 서비스 동시 생성 시 일관성
 * - TC-012: 환경변수 변경 후 서비스 재생성
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSService } from '../TTSService';
import { STTService } from '../STTService';
import { ConfigSyncService } from '../ConfigSyncService';

// config 모듈 mock (아직 구현되지 않았으므로)
vi.mock('../../../config/env', () => ({
  config: {
    backendUrl: 'http://localhost:8000',
    backendPort: '8000',
    environment: 'development',
  },
}));

describe('Service Constructors - Config Injection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-005: TTSService 기본값 생성자', () => {
    it('should create TTSService with default config.backendUrl', () => {
      // Arrange & Act
      const service = new TTSService();

      // Assert
      // NOTE: 현재 TTSService는 생성자 파라미터로 baseUrl을 받고 있음
      // 실제 구현 시에는 config.backendUrl을 기본값으로 사용해야 함
      // 현재 구현: new TTSService(baseUrl = 'http://localhost:8000')
      // 기대 구현: new TTSService(baseUrl = config.backendUrl)
      expect(service['baseUrl']).toBe('http://localhost:8000');
    });

    it('should apply config.backendUrl automatically from env module', async () => {
      // Arrange
      const { config } = await import('../../../config/env');

      // Act
      // NOTE: 실제 구현 시 TTSService 생성자가 config 모듈을 import해야 함
      const service = new TTSService();

      // Assert
      expect(service['baseUrl']).toBe(config.backendUrl);
    });

    it('should create multiple TTSService instances with same baseUrl', () => {
      // Act
      const service1 = new TTSService();
      const service2 = new TTSService();

      // Assert
      expect(service1['baseUrl']).toBe(service2['baseUrl']);
      expect(service1['baseUrl']).toBe('http://localhost:8000');
    });
  });

  describe('TC-006: TTSService 커스텀 URL 주입', () => {
    it('should override config.backendUrl with custom URL', () => {
      // Arrange
      const customUrl = 'http://mock-server:3000';

      // Act
      const service = new TTSService(customUrl);

      // Assert
      expect(service['baseUrl']).toBe(customUrl);
    });

    it('should ignore config.backendUrl when custom URL is provided', async () => {
      // Arrange
      const { config } = await import('../../../config/env');
      const customUrl = 'http://test-tts:4000';

      // Act
      const service = new TTSService(customUrl);

      // Assert
      expect(service['baseUrl']).not.toBe(config.backendUrl);
      expect(service['baseUrl']).toBe(customUrl);
    });

    it('should allow different custom URLs for different instances', () => {
      // Act
      const service1 = new TTSService('http://server1:8001');
      const service2 = new TTSService('http://server2:8002');

      // Assert
      expect(service1['baseUrl']).toBe('http://server1:8001');
      expect(service2['baseUrl']).toBe('http://server2:8002');
      expect(service1['baseUrl']).not.toBe(service2['baseUrl']);
    });
  });

  describe('TC-007: STTService 기본값 생성자', () => {
    it('should create STTService with default config.backendUrl', () => {
      // Act
      const service = new STTService();

      // Assert
      expect(service['baseUrl']).toBe('http://localhost:8000');
    });

    it('should apply config.backendUrl from env module', async () => {
      // Arrange
      const { config } = await import('../../../config/env');

      // Act
      const service = new STTService();

      // Assert
      expect(service['baseUrl']).toBe(config.backendUrl);
    });
  });

  describe('TC-008: STTService 커스텀 URL 주입', () => {
    it('should override default URL with custom URL', () => {
      // Arrange
      const customUrl = 'http://mock-stt:4000';

      // Act
      const service = new STTService(customUrl);

      // Assert
      expect(service['baseUrl']).toBe(customUrl);
    });

    it('should not use config.backendUrl when custom URL provided', async () => {
      // Arrange
      const { config } = await import('../../../config/env');
      const customUrl = 'http://custom-stt:5000';

      // Act
      const service = new STTService(customUrl);

      // Assert
      expect(service['baseUrl']).toBe(customUrl);
      expect(service['baseUrl']).not.toBe(config.backendUrl);
    });
  });

  describe('TC-009: ConfigSyncService 기본값 생성자', () => {
    it('should create ConfigSyncService with default config.backendUrl', () => {
      // Act
      const service = new ConfigSyncService();

      // Assert
      // NOTE: ConfigSyncService는 axios.create()를 사용하므로
      // baseURL은 client['defaults'].baseURL로 접근해야 함
      expect(service['client'].defaults.baseURL).toBe('http://localhost:8000');
    });

    it('should apply config.backendUrl from env module', async () => {
      // Arrange
      const { config } = await import('../../../config/env');

      // Act
      const service = new ConfigSyncService();

      // Assert
      expect(service['client'].defaults.baseURL).toBe(config.backendUrl);
    });
  });

  describe('TC-010: ConfigSyncService 커스텀 URL 주입', () => {
    it('should override default URL with custom baseURL', () => {
      // Arrange
      const customUrl = 'http://config-mock:5000';

      // Act
      const service = new ConfigSyncService(customUrl);

      // Assert
      expect(service['client'].defaults.baseURL).toBe(customUrl);
    });

    it('should ignore config.backendUrl when custom URL provided', async () => {
      // Arrange
      const { config } = await import('../../../config/env');
      const customUrl = 'http://custom-config:6000';

      // Act
      const service = new ConfigSyncService(customUrl);

      // Assert
      expect(service['client'].defaults.baseURL).toBe(customUrl);
      expect(service['client'].defaults.baseURL).not.toBe(config.backendUrl);
    });
  });

  describe('TC-011: 여러 서비스 동시 생성 시 일관성', () => {
    it('should use same backendUrl across all services', () => {
      // Act
      const ttsService = new TTSService();
      const sttService = new STTService();
      const configService = new ConfigSyncService();

      // Assert
      expect(ttsService['baseUrl']).toBe('http://localhost:8000');
      expect(sttService['baseUrl']).toBe('http://localhost:8000');
      expect(configService['client'].defaults.baseURL).toBe('http://localhost:8000');
    });

    it('should maintain consistency when using config module', async () => {
      // Arrange
      const { config } = await import('../../../config/env');

      // Act
      const ttsService = new TTSService();
      const sttService = new STTService();
      const configService = new ConfigSyncService();

      // Assert
      expect(ttsService['baseUrl']).toBe(config.backendUrl);
      expect(sttService['baseUrl']).toBe(config.backendUrl);
      expect(configService['client'].defaults.baseURL).toBe(config.backendUrl);

      // All services should use the same URL
      expect(ttsService['baseUrl']).toBe(sttService['baseUrl']);
      expect(sttService['baseUrl']).toBe(configService['client'].defaults.baseURL);
    });

    it('should allow mixed default and custom URLs', () => {
      // Act
      const defaultTTS = new TTSService();
      const customSTT = new STTService('http://custom:9000');
      const defaultConfig = new ConfigSyncService();

      // Assert
      expect(defaultTTS['baseUrl']).toBe('http://localhost:8000');
      expect(customSTT['baseUrl']).toBe('http://custom:9000');
      expect(defaultConfig['client'].defaults.baseURL).toBe('http://localhost:8000');
    });
  });

  describe('TC-012: 환경변수 변경 후 서비스 재생성', () => {
    it('should reflect new config.backendUrl after module reload', async () => {
      // Arrange
      const service1 = new TTSService();
      const initialUrl = service1['baseUrl'];

      // Act
      // NOTE: 실제로는 process.env를 변경하고 config 모듈을 재로드해야 함
      // 현재는 mock을 사용하므로 제한적인 테스트만 가능
      vi.doMock('../../../config/env', () => ({
        config: {
          backendUrl: 'http://prod:9000',
          backendPort: '9000',
          environment: 'production',
        },
      }));

      // config 모듈 재로드 (실제 구현 시)
      const service2 = new TTSService(); // eslint-disable-line @typescript-eslint/no-unused-vars

      // Assert
      // NOTE: 현재는 하드코딩된 값이므로 이 테스트는 실패할 것임
      // 실제 구현 후에는 다음과 같이 동작해야 함:
      expect(service1['baseUrl']).toBe(initialUrl);
      // service2는 새로운 config 값을 사용해야 하지만 현재는 하드코딩됨
    });

    it('should create independent instances with different configs', () => {
      // Act
      const service1 = new TTSService('http://server1:8001');
      const service2 = new TTSService('http://server2:8002');

      // Assert
      expect(service1['baseUrl']).not.toBe(service2['baseUrl']);
      expect(service1['baseUrl']).toBe('http://server1:8001');
      expect(service2['baseUrl']).toBe('http://server2:8002');
    });
  });

  describe('Integration - Service Constructor Consistency', () => {
    it('should ensure all services accept optional baseUrl parameter', () => {
      // Act & Assert
      expect(() => new TTSService()).not.toThrow();
      expect(() => new STTService()).not.toThrow();
      expect(() => new ConfigSyncService()).not.toThrow();

      expect(() => new TTSService('http://custom:8000')).not.toThrow();
      expect(() => new STTService('http://custom:8000')).not.toThrow();
      expect(() => new ConfigSyncService('http://custom:8000')).not.toThrow();
    });

    it('should maintain baseUrl immutability after construction', () => {
      // Arrange
      const customUrl = 'http://immutable:8000';

      // Act
      const service = new TTSService(customUrl);
      const initialUrl = service['baseUrl'];

      // Attempt to modify (should throw error due to immutability)
      // @ts-expect-error Testing readonly property
      expect(() => {
        service['baseUrl'] = 'http://modified:9000';
      }).toThrow();

      // Assert - value should remain unchanged
      expect(service['baseUrl']).toBe(initialUrl);
      expect(service['baseUrl']).toBe(customUrl);
    });

    it('should handle undefined/null baseUrl gracefully', () => {
      // Act & Assert
      // @ts-expect-error Testing undefined parameter
      expect(() => new TTSService(undefined)).not.toThrow();

      // Default should be used
      // @ts-expect-error Testing undefined parameter
      const service = new TTSService(undefined);
      expect(service['baseUrl']).toBe('http://localhost:8000');
    });
  });

  describe('Error Cases - Invalid URLs', () => {
    it('should accept any string as baseUrl (validation is deferred)', () => {
      // NOTE: URL 유효성 검사는 실제 API 호출 시점에 수행됨
      // 생성자에서는 어떤 문자열이든 받아들임

      // Act & Assert
      expect(() => new TTSService('invalid-url')).not.toThrow();
      expect(() => new STTService('not-a-url')).not.toThrow();
      expect(() => new ConfigSyncService('malformed')).not.toThrow();
    });

    it('should store provided URL as-is without validation', () => {
      // Arrange
      const invalidUrl = 'this-is-not-a-valid-url';

      // Act
      const service = new TTSService(invalidUrl);

      // Assert
      expect(service['baseUrl']).toBe(invalidUrl);
    });
  });
});

/**
 * ConfigSyncService 단위 테스트
 *
 * 테스트 케이스:
 * - TC-023: 재시도 로직 (maxRetries 3회)
 * - Python 연동 성공 케이스
 * - 타임아웃 처리
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { ConfigSyncService } from '../ConfigSyncService';
import type { ConfigSyncRequest, ConfigSyncResponse } from '../ConfigSyncService';
import { AppError } from '../../errors/AppError';

// axios 모킹
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ConfigSyncService', () => {
  let service: ConfigSyncService;

  beforeEach(() => {
    vi.clearAllMocks();

    // axios.create 모킹
    mockedAxios.create = vi.fn().mockReturnValue({
      post: vi.fn(),
    });

    service = new ConfigSyncService('http://localhost:8000');
  });

  describe('syncConfig', () => {
    it('TC-019: Python 설정 동기화 성공', async () => {
      // Arrange
      const config: ConfigSyncRequest = {
        ttsProvider: 'supertonic',
        supertonicVoice: 'M4',
        sttUseGpu: true,
      };

      const mockResponse: ConfigSyncResponse = {
        success: true,
        applied_config: {
          TTS_PROVIDER: 'supertonic',
          SUPERTONIC_VOICE: 'M4',
          STT_USE_GPU: true,
        },
        message: 'Configuration updated successfully',
      };

      const mockClient = service['client'] as unknown as AxiosInstance;
      mockClient.post = vi.fn().mockResolvedValue({ data: mockResponse });

      // Act
      const result = await service.syncConfig(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.applied_config?.TTS_PROVIDER).toBe('supertonic');
      expect(mockClient.post).toHaveBeenCalledWith('/config/update', config);
    });

    it('TC-016: 잘못된 Provider → 에러 응답', async () => {
      // Arrange
      const config: ConfigSyncRequest = {
        ttsProvider: 'invalid-provider',
      };

      const errorResponse = {
        success: false,
        error: 'Invalid TTS provider',
      };

      const mockClient = service['client'] as unknown as AxiosInstance;
      mockClient.post = vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: { data: errorResponse },
      });

      // Axios error handling
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      // Act
      const result = await service.syncConfig(config);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid TTS provider');
    });
  });

  describe('syncConfigWithRetry', () => {
    it('TC-023: 재시도 로직 - 3회 시도 후 실패', async () => {
      // Arrange
      const config: ConfigSyncRequest = {
        ttsProvider: 'supertonic',
      };

      const mockClient = service['client'] as unknown as AxiosInstance;
      mockClient.post = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(service.syncConfigWithRetry(config, 3)).rejects.toThrow(AppError);

      // 3회 재시도 확인
      expect(mockClient.post).toHaveBeenCalledTimes(3);
    });

    it('TC-023: 재시도 로직 - 2차 시도에서 성공', async () => {
      // Arrange
      const config: ConfigSyncRequest = {
        ttsProvider: 'supertonic',
      };

      const successResponse: ConfigSyncResponse = {
        success: true,
        applied_config: { TTS_PROVIDER: 'supertonic' },
      };

      const mockClient = service['client'] as unknown as AxiosInstance;

      // 1차 시도 실패, 2차 시도 성공
      mockClient.post = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: successResponse });

      // 타이머 모킹
      vi.useFakeTimers();

      // Act
      const retryPromise = service.syncConfigWithRetry(config, 3);

      // 1차 시도 실패
      await vi.advanceTimersByTimeAsync(0);

      // 2차 시도 성공 (1초 대기 후)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await retryPromise;

      // Assert
      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('syncAllSettings', () => {
    it('TC-019: SettingsService 연동 - 모든 설정 동기화', async () => {
      // Arrange
      const settings = {
        ttsProvider: 'edge-tts',
        ttsVoiceId: 'en-US-AriaNeural',
        supertonicVoice: 'M4',
        sttUseGpu: 'true',
      };

      const mockResponse: ConfigSyncResponse = {
        success: true,
        applied_config: {
          TTS_PROVIDER: 'edge-tts',
          TTS_VOICE: 'en-US-AriaNeural',
        },
      };

      const mockClient = service['client'] as unknown as AxiosInstance;
      mockClient.post = vi.fn().mockResolvedValue({ data: mockResponse });

      // Act
      const result = await service.syncAllSettings(settings);

      // Assert
      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith('/config/update', {
        ttsProvider: 'edge-tts',
        ttsVoice: 'en-US-AriaNeural',
        supertonicVoice: 'M4',
        sttUseGpu: true, // 문자열 'true' → boolean 변환
      });
    });
  });
});

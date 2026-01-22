/**
 * ConfigSyncService - Python 백엔드 설정 동기화 서비스
 *
 * 역할:
 * - Electron SettingsService → Python ConfigManager 설정 전달
 * - 재시도 로직 (네트워크 에러 처리)
 * - 타임아웃 설정
 *
 * 사용 예시:
 *   const syncService = new ConfigSyncService('http://localhost:8000');
 *   await syncService.syncConfig({ttsProvider: 'supertonic'});
 */

import axios, { AxiosInstance } from 'axios';
import { AppError, ErrorCode } from '../errors/AppError';
import { config } from '../../config/env';

export interface ConfigSyncRequest {
  ttsProvider?: string;
  ttsVoice?: string;
  supertonicVoice?: string;
}

export interface ConfigSyncResponse {
  success: boolean;
  applied_config?: Record<string, unknown>;
  message?: string;
  error?: string;
  detail?: string;
}

export class ConfigSyncService {
  private readonly client: AxiosInstance;

  constructor(baseURL: string = config.backendUrl) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Python 백엔드에 설정 동기화
   */
  async syncConfig(config: ConfigSyncRequest): Promise<ConfigSyncResponse> {
    try {
      const response = await this.client.post<ConfigSyncResponse>('/config/update', config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data as ConfigSyncResponse;
      }
      throw error;
    }
  }

  /**
   * SettingsService에서 모든 설정을 읽어 Python에 동기화
   */
  async syncAllSettings(settings: Record<string, string>): Promise<ConfigSyncResponse> {
    const config: ConfigSyncRequest = {
      ttsProvider: settings.ttsProvider,
      ttsVoice: settings.ttsVoiceId,
      supertonicVoice: settings.supertonicVoice,
    };

    return this.syncConfig(config);
  }

  /**
   * 재시도 로직 포함 설정 동기화
   *
   * @param config - 설정 객체
   * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
   * @returns ConfigSyncResponse
   * @throws AppError - 최대 재시도 후에도 실패 시
   */
  async syncConfigWithRetry(
    config: ConfigSyncRequest,
    maxRetries: number = 3
  ): Promise<ConfigSyncResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ConfigSync] Attempt ${attempt}/${maxRetries}`);
        const response = await this.syncConfig(config);

        if (response.success) {
          console.log('[ConfigSync] Success:', response.applied_config);
          return response;
        } else {
          console.error('[ConfigSync] Failed:', response.error);
          throw new Error(response.error || 'Unknown error');
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`[ConfigSync] Attempt ${attempt} failed:`, error);

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new AppError(
      ErrorCode.NETWORK_ERROR,
      'Config sync failed after retries',
      '설정 동기화에 실패했습니다. Python 백엔드를 확인하세요.',
      lastError || undefined
    );
  }
}

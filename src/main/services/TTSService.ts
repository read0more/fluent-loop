import axios from 'axios';
import { TTSResult, Voice } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

interface AxiosLikeError {
  code?: string;
  response?: {
    status?: number;
    data?: unknown;
  };
}

export interface ITTSService {
  checkHealth(): Promise<boolean>;
  synthesizeSpeech(text: string, voiceId?: string): Promise<TTSResult>;
  getAvailableVoices(): Promise<Voice[]>;
}

export class TTSService implements ITTSService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get<{ status: string; tts_loaded?: boolean }>(
        `${this.baseUrl}/health`,
        {
          timeout: 5000,
        }
      );
      return (
        response.status === 200 &&
        response.data.status === 'ok' &&
        response.data.tts_loaded === true
      );
    } catch {
      return false;
    }
  }

  async synthesizeSpeech(text: string, voiceId?: string): Promise<TTSResult> {
    try {
      // 텍스트 검증
      if (!text || !text.trim()) {
        throw new AppError(
          ErrorCode.TTS_INVALID_REQUEST,
          'Empty text provided',
          '텍스트를 입력해주세요.'
        );
      }

      interface PythonTTSResponse {
        success: boolean;
        file_path?: string;
        duration?: number;
        voice_id?: string;
        error?: string;
      }

      const response = await axios.post<PythonTTSResponse>(
        `${this.baseUrl}/tts/synthesize`,
        {
          text,
          voice_id: voiceId,
        },
        {
          timeout: 60000, // 60초 타임아웃 (긴 텍스트 고려)
        }
      );

      // 응답에서 success가 false인 경우
      if (response.data && !response.data.success) {
        const errorMsg = response.data.error || 'TTS synthesis failed';

        if (errorMsg.toLowerCase().includes('voice')) {
          throw new AppError(
            ErrorCode.TTS_VOICE_NOT_FOUND,
            errorMsg,
            '선택한 음성을 찾을 수 없습니다. 다른 음성을 선택해주세요.'
          );
        }

        throw new AppError(
          ErrorCode.TTS_SYNTHESIS_FAILED,
          errorMsg,
          '음성 생성에 실패했습니다. 다시 시도해주세요.'
        );
      }

      // snake_case → camelCase 변환
      return {
        success: response.data.success,
        filePath: response.data.file_path,
        duration: response.data.duration,
        voiceId: response.data.voice_id,
        error: response.data.error,
      };
    } catch (error: unknown) {
      // AppError는 그대로 throw
      if (error instanceof AppError) {
        throw error;
      }

      // Axios 에러 처리
      const axiosError = error as AxiosLikeError;

      if (axiosError.code === 'ECONNREFUSED') {
        throw new AppError(
          ErrorCode.TTS_SERVICE_UNAVAILABLE,
          'Python backend is not running',
          'TTS 서버에 연결할 수 없습니다. 백엔드 서버를 시작해주세요.'
        );
      }

      if (axiosError.response?.status === 400) {
        const responseData = axiosError.response?.data as { error?: string } | undefined;
        const errorMsg = responseData?.error || 'Invalid request';

        if (errorMsg.toLowerCase().includes('voice')) {
          throw new AppError(
            ErrorCode.TTS_VOICE_NOT_FOUND,
            errorMsg,
            '음성 ID가 올바르지 않습니다.'
          );
        }

        throw new AppError(ErrorCode.TTS_INVALID_REQUEST, errorMsg, '잘못된 요청입니다.');
      }

      if (axiosError.response?.status === 503) {
        throw new AppError(
          ErrorCode.TTS_SERVICE_UNAVAILABLE,
          'TTS service not loaded',
          'TTS 서비스를 사용할 수 없습니다.'
        );
      }

      if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
        throw new AppError(
          ErrorCode.TTS_SYNTHESIS_FAILED,
          'TTS request timeout',
          'TTS 처리 시간이 초과되었습니다. 텍스트를 줄이거나 다시 시도해주세요.'
        );
      }

      // 기타 에러
      throw new AppError(
        ErrorCode.TTS_SYNTHESIS_FAILED,
        'TTS synthesis failed',
        '음성 생성에 실패했습니다. 다시 시도해주세요.',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAvailableVoices(): Promise<Voice[]> {
    try {
      const response = await axios.get<{ voices: Voice[] }>(`${this.baseUrl}/tts/voices`, {
        timeout: 10000,
      });

      return response.data.voices || [];
    } catch (error: unknown) {
      const axiosError = error as AxiosLikeError;

      if (axiosError.code === 'ECONNREFUSED') {
        throw new AppError(
          ErrorCode.TTS_SERVICE_UNAVAILABLE,
          'Python backend is not running',
          'TTS 서버에 연결할 수 없습니다.'
        );
      }

      throw new AppError(
        ErrorCode.TTS_SERVICE_UNAVAILABLE,
        'Failed to get voices',
        '음성 목록을 가져오는데 실패했습니다.',
        error instanceof Error ? error : undefined
      );
    }
  }
}

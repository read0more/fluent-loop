import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { STTResult } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

export interface ISTTService {
  checkHealth(): Promise<boolean>;
  transcribeAudio(filePath: string, language?: string): Promise<STTResult>;
}

export class STTService implements ISTTService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get<{ status: string }>(`${this.baseUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200 && response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  async transcribeAudio(filePath: string, language: string = 'ko'): Promise<STTResult> {
    try {
      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        throw new AppError(
          ErrorCode.AUDIO_FILE_INVALID,
          'Audio file not found',
          '오디오 파일을 찾을 수 없습니다.'
        );
      }

      const formData = new FormData();
      formData.append('audio', fs.createReadStream(filePath));
      formData.append('language', language);

      const response = await axios.post<STTResult>(`${this.baseUrl}/stt/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000, // 60초 타임아웃
      });

      return response.data;
    } catch (error: any) {
      if (error.isAxiosError || error.response || error.request) {
        if (error.code === 'ECONNREFUSED') {
          throw new AppError(
            ErrorCode.STT_SERVICE_UNAVAILABLE,
            'Python backend is not running',
            'STT 서버에 연결할 수 없습니다. 백엔드 서버를 시작해주세요.'
          );
        }

        if (error.response?.status === 400) {
          throw new AppError(
            ErrorCode.AUDIO_FILE_INVALID,
            'Invalid audio file',
            '오디오 파일 형식이 올바르지 않습니다.'
          );
        }

        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          throw new AppError(
            ErrorCode.STT_PROCESSING_FAILED,
            'STT request timeout',
            'STT 처리 시간이 초과되었습니다. 다시 시도해주세요.'
          );
        }
      }

      throw new AppError(
        ErrorCode.STT_PROCESSING_FAILED,
        'STT processing failed',
        '음성 인식에 실패했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }
}

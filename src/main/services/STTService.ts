import axios, { AxiosError } from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { STTResult } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

/**
 * STT 스트리밍 청크 결과 (확장)
 */
export interface STTStreamChunkResult extends STTResult {
  is_final: boolean; // 최종 결과 여부 (false: 중간 청크, true: 녹음 종료)
}

export interface ISTTService {
  checkHealth(): Promise<boolean>;
  transcribeAudio(filePath: string, language?: string): Promise<STTResult>;
  transcribeAudioStream(
    filePath: string,
    language?: string,
    context?: string,
    useGpu?: boolean,
    isRecording?: boolean
  ): Promise<STTStreamChunkResult>;
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
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      if (axios.isAxiosError(axiosError)) {
        if (axiosError.code === 'ECONNREFUSED') {
          throw new AppError(
            ErrorCode.STT_SERVICE_UNAVAILABLE,
            'Python backend is not running',
            'STT 서버에 연결할 수 없습니다. 백엔드 서버를 시작해주세요.'
          );
        }

        if (axiosError.response?.status === 400) {
          throw new AppError(
            ErrorCode.AUDIO_FILE_INVALID,
            'Invalid audio file',
            '오디오 파일 형식이 올바르지 않습니다.'
          );
        }

        if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
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

  /**
   * 오디오 청크 실시간 STT 변환 (신규 - Step5용)
   *
   * @param filePath 청크 오디오 파일 경로
   * @param language 언어 코드 (기본값: ko)
   * @param context 이전 청크의 텍스트 (컨텍스트 유지)
   * @param useGpu GPU 사용 여부 (기본값: false)
   * @param isRecording 녹음 중 여부 (true일 때 타임아웃 비활성화)
   * @returns STT 변환 결과 (is_final=false)
   */
  async transcribeAudioStream(
    filePath: string,
    language: string = 'ko',
    context: string = '',
    useGpu: boolean = false,
    isRecording: boolean = false
  ): Promise<STTStreamChunkResult> {
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
      formData.append('context', context);
      formData.append('use_gpu', useGpu ? 'true' : 'false');

      const response = await axios.post<STTStreamChunkResult>(
        `${this.baseUrl}/stt/stream-chunk`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: isRecording ? 0 : 10000, // 녹음 중이면 타임아웃 없음
        }
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      if (axios.isAxiosError(axiosError)) {
        if (axiosError.code === 'ECONNREFUSED') {
          throw new AppError(
            ErrorCode.STT_SERVICE_UNAVAILABLE,
            'Python backend is not running',
            'STT 서버에 연결할 수 없습니다. 백엔드 서버를 시작해주세요.'
          );
        }

        if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
          // 타임아웃은 에러로 반환 (graceful degradation)
          return {
            success: false,
            text: '',
            language,
            duration: 0,
            is_final: false,
            error: 'STT 처리 시간이 초과되었습니다.',
          };
        }
      }

      throw new AppError(
        ErrorCode.STT_PROCESSING_FAILED,
        'STT stream chunk processing failed',
        '음성 인식 중 오류가 발생했습니다.',
        error as Error
      );
    }
  }
}

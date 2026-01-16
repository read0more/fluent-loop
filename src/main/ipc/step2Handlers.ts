import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import { TTSService, BackendHealthStatus } from '../services/TTSService';
import { TTSCacheService } from '../services/TTSCacheService';
import { AudioService } from '../services/AudioService';
import { SettingsService } from '../services/SettingsService';
import { getDatabase } from '../database/db';
import { AppError } from '../errors/AppError';
import { IPCResponse, TTSResult, Voice, RecordingFile, AppSettings } from '../database/models';

// 서비스 인스턴스
let ttsService: TTSService;
let ttsCacheService: TTSCacheService;
let audioService: AudioService;
let settingsService: SettingsService;

// Step2 녹음 상태 관리
let isRecordingStep2 = false;
let recordingStartTimeStep2: number | null = null;

export async function registerStep2Handlers(): Promise<void> {
  // 서비스 초기화
  ttsCacheService = new TTSCacheService();
  await ttsCacheService.initialize();
  ttsService = new TTSService('http://localhost:8000', ttsCacheService);
  audioService = new AudioService();
  settingsService = new SettingsService(getDatabase());

  // TTS 관련 핸들러
  ipcMain.handle('synthesize-tts', handleSynthesizeTTS);
  ipcMain.handle('get-tts-voices', handleGetTTSVoices);
  ipcMain.handle('clear-tts-cache', handleClearTTSCache);
  ipcMain.handle('get-backend-health', handleGetBackendHealth);

  // 녹음 관련 핸들러
  ipcMain.handle('start-recording-step2', handleStartRecordingStep2);
  ipcMain.handle('stop-recording-step2', handleStopRecordingStep2);
  ipcMain.handle('save-recording-step2', handleSaveRecordingStep2);
  ipcMain.handle('list-recordings-step2', handleListRecordingsStep2);
  ipcMain.handle('delete-recording', handleDeleteRecording);

  // 설정 관련 핸들러
  ipcMain.handle('get-setting', handleGetSetting);
  ipcMain.handle('save-setting', handleSaveSetting);
  ipcMain.handle('get-all-settings', handleGetAllSettings);
  ipcMain.handle('reset-settings', handleResetSettings);
  ipcMain.handle('select-folder', handleSelectFolder);
}

// TTS 요청 타입 (speaker 지원)
interface TTSRequestWithSpeaker {
  text: string;
  voiceId?: string;
  speaker?: 'user' | 'ai';
}

// ==================== TTS 핸들러 ====================

async function handleSynthesizeTTS(
  _event: IpcMainInvokeEvent,
  textOrRequest: string | TTSRequestWithSpeaker,
  voiceId?: string
): Promise<IPCResponse<TTSResult>> {
  try {
    let text: string;
    let effectiveVoiceId: string | undefined = voiceId;

    // 호환성: 기존 string 파라미터 또는 객체 파라미터 지원
    if (typeof textOrRequest === 'string') {
      text = textOrRequest;
    } else {
      text = textOrRequest.text;
      effectiveVoiceId = textOrRequest.voiceId;

      // speaker가 있으면 해당 화자의 설정 음성 사용
      if (!effectiveVoiceId && textOrRequest.speaker) {
        const settingKey = textOrRequest.speaker === 'user' ? 'ttsVoiceIdUser' : 'ttsVoiceId';
        effectiveVoiceId = (await settingsService.getSetting(settingKey)) || undefined;
      }
    }

    // voiceId가 없으면 기본 음성(AI 음성) 사용
    if (!effectiveVoiceId) {
      const defaultVoice = await settingsService.getSetting('ttsVoiceId');
      effectiveVoiceId = defaultVoice || 'en-US-AriaNeural';
    }

    const result = await ttsService.synthesizeSpeech(text, effectiveVoiceId);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '음성 생성에 실패했습니다.',
    };
  }
}

async function handleGetTTSVoices(): Promise<IPCResponse<Voice[]>> {
  try {
    const voices = await ttsService.getAvailableVoices();

    return {
      success: true,
      data: voices,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '음성 목록 조회에 실패했습니다.',
    };
  }
}

async function handleClearTTSCache(): Promise<IPCResponse<void>> {
  try {
    await ttsCacheService.clearCache();
    return { success: true };
  } catch (error) {
    console.error('[IPC] Failed to clear TTS cache:', error);
    return {
      success: false,
      error: '캐시 삭제에 실패했습니다.',
    };
  }
}

async function handleGetBackendHealth(): Promise<IPCResponse<BackendHealthStatus>> {
  try {
    const healthStatus = await ttsService.getHealthStatus();

    if (!healthStatus) {
      return {
        success: false,
        error: '백엔드 서버에 연결할 수 없습니다.',
      };
    }

    return {
      success: true,
      data: healthStatus,
    };
  } catch {
    return {
      success: false,
      error: '백엔드 상태 확인에 실패했습니다.',
    };
  }
}

// ==================== 녹음 핸들러 ====================

async function handleStartRecordingStep2(): Promise<IPCResponse<void>> {
  try {
    if (isRecordingStep2) {
      return {
        success: false,
        error: '이미 녹음 중입니다.',
      };
    }

    isRecordingStep2 = true;
    recordingStartTimeStep2 = Date.now();

    return { success: true };
  } catch {
    isRecordingStep2 = false;
    recordingStartTimeStep2 = null;

    return {
      success: false,
      error: '녹음 시작에 실패했습니다.',
    };
  }
}

async function handleStopRecordingStep2(
  _event: IpcMainInvokeEvent,
  audioData: Uint8Array | Buffer
): Promise<IPCResponse<{ filePath: string; duration: number }>> {
  try {
    if (!isRecordingStep2) {
      return {
        success: false,
        error: '녹음 중이 아닙니다.',
      };
    }

    const duration = recordingStartTimeStep2 ? (Date.now() - recordingStartTimeStep2) / 1000 : 0;

    // 최소 1초 이상 녹음 확인
    if (duration < 1) {
      isRecordingStep2 = false;
      recordingStartTimeStep2 = null;
      return {
        success: false,
        error: '최소 1초 이상 녹음해주세요.',
      };
    }

    // 사용자 지정 경로 가져오기
    const settings = await settingsService.getAllSettings();
    const customPath = settings.recordingSavePath;

    // Uint8Array를 Buffer로 변환
    const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);

    const filePath = await audioService.saveRecordingStep2(
      audioBuffer,
      'recording.m4a',
      customPath || undefined
    );

    isRecordingStep2 = false;
    recordingStartTimeStep2 = null;

    return {
      success: true,
      data: { filePath, duration },
    };
  } catch (error) {
    isRecordingStep2 = false;
    recordingStartTimeStep2 = null;

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '녹음 저장에 실패했습니다.',
    };
  }
}

async function handleSaveRecordingStep2(
  _event: IpcMainInvokeEvent,
  audioData: Uint8Array | Buffer,
  filename: string = 'recording.m4a'
): Promise<IPCResponse<{ filePath: string }>> {
  try {
    // 사용자 지정 경로 가져오기
    const settings = await settingsService.getAllSettings();
    const customPath = settings.recordingSavePath;

    // Uint8Array를 Buffer로 변환
    const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);

    const filePath = await audioService.saveRecordingStep2(
      audioBuffer,
      filename,
      customPath || undefined
    );

    return {
      success: true,
      data: { filePath },
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '녹음 파일 저장에 실패했습니다.',
    };
  }
}

async function handleListRecordingsStep2(
  _event: IpcMainInvokeEvent
): Promise<IPCResponse<RecordingFile[]>> {
  try {
    const settings = await settingsService.getAllSettings();
    const customPath = settings.recordingSavePath;

    const recordings = await audioService.listRecordings(2, customPath || undefined);

    return {
      success: true,
      data: recordings,
    };
  } catch {
    return {
      success: false,
      error: '녹음 목록 조회에 실패했습니다.',
    };
  }
}

async function handleDeleteRecording(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<IPCResponse<void>> {
  try {
    await audioService.deleteRecording(filePath);

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '녹음 파일 삭제에 실패했습니다.',
    };
  }
}

// ==================== 설정 핸들러 ====================

async function handleGetSetting(
  _event: IpcMainInvokeEvent,
  key: string
): Promise<IPCResponse<string | null>> {
  try {
    const value = await settingsService.getSetting(key);

    return {
      success: true,
      data: value,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '설정 조회에 실패했습니다.',
    };
  }
}

async function handleSaveSetting(
  _event: IpcMainInvokeEvent,
  key: string,
  value: string
): Promise<IPCResponse<void>> {
  try {
    await settingsService.saveSetting(key, value);

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '설정 저장에 실패했습니다.',
    };
  }
}

async function handleGetAllSettings(): Promise<IPCResponse<AppSettings>> {
  try {
    const settings = await settingsService.getAllSettings();

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '설정 조회에 실패했습니다.',
    };
  }
}

async function handleResetSettings(): Promise<IPCResponse<void>> {
  try {
    await settingsService.resetToDefaults();

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '설정 초기화에 실패했습니다.',
    };
  }
}

async function handleSelectFolder(): Promise<IPCResponse<{ folderPath: string }>> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '녹음 파일 저장 위치 선택',
    });

    // showOpenDialog 반환값 체크 (타입 정의가 잘못되어 있어 any로 처리)
    const resultAny = result as unknown as { canceled: boolean; filePaths: string[] };
    if (resultAny.canceled || !resultAny.filePaths || resultAny.filePaths.length === 0) {
      return {
        success: false,
        error: '폴더 선택이 취소되었습니다.',
      };
    }

    const folderPath = resultAny.filePaths[0] as string;

    // 경로 유효성 검증
    const isValid = await audioService.validateSavePath(folderPath);

    if (!isValid) {
      return {
        success: false,
        error: '선택한 폴더에 접근할 수 없습니다.',
      };
    }

    return {
      success: true,
      data: { folderPath },
    };
  } catch {
    return {
      success: false,
      error: '폴더 선택에 실패했습니다.',
    };
  }
}

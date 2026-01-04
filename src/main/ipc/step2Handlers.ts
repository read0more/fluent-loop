import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import { TTSService } from '../services/TTSService';
import { AudioService } from '../services/AudioService';
import { SettingsService } from '../services/SettingsService';
import { getDatabase } from '../database/db';
import { AppError } from '../errors/AppError';
import { IPCResponse, TTSResult, Voice, RecordingFile, AppSettings } from '../database/models';

// 서비스 인스턴스
let ttsService: TTSService;
let audioService: AudioService;
let settingsService: SettingsService;

export function registerStep2Handlers(): void {
  // 서비스 초기화
  ttsService = new TTSService();
  audioService = new AudioService();
  settingsService = new SettingsService(getDatabase());

  // TTS 관련 핸들러
  ipcMain.handle('synthesize-tts', handleSynthesizeTTS);
  ipcMain.handle('get-tts-voices', handleGetTTSVoices);

  // 녹음 관련 핸들러
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

// ==================== TTS 핸들러 ====================

async function handleSynthesizeTTS(
  _event: IpcMainInvokeEvent,
  text: string,
  voiceId?: string
): Promise<IPCResponse<TTSResult>> {
  try {
    // 설정에서 기본 음성 가져오기
    if (!voiceId) {
      const defaultVoice = await settingsService.getSetting('ttsVoiceId');
      voiceId = defaultVoice || 'en-US-AriaNeural';
    }

    const result = await ttsService.synthesizeSpeech(text, voiceId);

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

// ==================== 녹음 핸들러 ====================

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

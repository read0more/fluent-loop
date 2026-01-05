import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AudioService } from '../services/AudioService';
import { AppError } from '../errors/AppError';
import { IPCResponse, RecordingFile } from '../database/models';

// Service instance
let audioService: AudioService;

// Step3 recording state management
let isRecordingStep3 = false;
let recordingStartTimeStep3: number | null = null;

export interface StartRecordingStep3Args {
  duration: 3 | 2 | 1;
}

export interface StopRecordingStep3Args {
  duration: 3 | 2 | 1;
  audioData: Uint8Array;
}

export interface ListRecordingsStep3Args {
  duration?: 3 | 2 | 1;
}

export interface DeleteRecordingStep3Args {
  filePath: string;
}

export interface Step3RecordingResult {
  filePath: string;
  duration: 3 | 2 | 1;
  actualDuration: number;
}

export function registerStep3Handlers(): void {
  // Service initialization
  audioService = new AudioService();

  // Recording handlers
  ipcMain.handle('start-recording-step3', handleStartRecordingStep3);
  ipcMain.handle('stop-recording-step3', handleStopRecordingStep3);
  ipcMain.handle('list-recordings-step3', handleListRecordingsStep3);
  ipcMain.handle('delete-recording-step3', handleDeleteRecordingStep3);
}

// ==================== Recording Handlers ====================

async function handleStartRecordingStep3(
  _event: IpcMainInvokeEvent,
  _args: StartRecordingStep3Args
): Promise<IPCResponse<void>> {
  try {
    if (isRecordingStep3) {
      return {
        success: false,
        error: '이미 녹음 중입니다.',
        errorCode: 'RECORDING_IN_PROGRESS',
      };
    }

    isRecordingStep3 = true;
    recordingStartTimeStep3 = Date.now();

    return { success: true };
  } catch {
    isRecordingStep3 = false;
    recordingStartTimeStep3 = null;

    return {
      success: false,
      error: '녹음 시작에 실패했습니다.',
    };
  }
}

async function handleStopRecordingStep3(
  _event: IpcMainInvokeEvent,
  args: StopRecordingStep3Args
): Promise<IPCResponse<Step3RecordingResult>> {
  try {
    if (!isRecordingStep3) {
      return {
        success: false,
        error: '녹음 중이 아닙니다.',
        errorCode: 'NOT_RECORDING',
      };
    }

    const actualDuration = recordingStartTimeStep3
      ? Math.floor((Date.now() - recordingStartTimeStep3) / 1000)
      : 0;

    // Minimum 1 second recording check
    if (actualDuration < 1) {
      isRecordingStep3 = false;
      recordingStartTimeStep3 = null;
      return {
        success: false,
        error: '최소 1초 이상 녹음해주세요.',
      };
    }

    // Convert Uint8Array to Buffer
    const audioBuffer = Buffer.isBuffer(args.audioData)
      ? args.audioData
      : Buffer.from(args.audioData);

    const filePath = await audioService.saveRecordingStep3(audioBuffer, args.duration);

    isRecordingStep3 = false;
    recordingStartTimeStep3 = null;

    return {
      success: true,
      data: {
        filePath,
        duration: args.duration,
        actualDuration,
      },
    };
  } catch (error) {
    isRecordingStep3 = false;
    recordingStartTimeStep3 = null;

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

async function handleListRecordingsStep3(
  _event: IpcMainInvokeEvent,
  args: ListRecordingsStep3Args = {}
): Promise<IPCResponse<RecordingFile[]>> {
  try {
    const recordings = await audioService.listRecordingsStep3(args.duration);

    return {
      success: true,
      data: recordings,
    };
  } catch (error) {
    console.error('Failed to list step3 recordings:', error);
    return {
      success: false,
      error: '녹음 목록 조회에 실패했습니다.',
    };
  }
}

async function handleDeleteRecordingStep3(
  _event: IpcMainInvokeEvent,
  args: DeleteRecordingStep3Args
): Promise<IPCResponse<void>> {
  try {
    await audioService.deleteRecording(args.filePath);

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

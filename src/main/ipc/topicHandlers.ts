import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AudioService } from '../services/AudioService';
import { STTService } from '../services/STTService';
import { ClaudeService } from '../services/ClaudeService';
import { TopicRepository } from '../database/repositories/TopicRepository';
import { getDatabase } from '../database/db';
import { AppError } from '../errors/AppError';
import {
  IPCResponse,
  RecordingResult,
  TranscribeArgs,
  GenerateTopicArgs,
  SaveTopicArgs,
  SaveTopicResult,
  STTResult,
  TopicGenerationResult,
  Topic,
} from '../database/models';

// 서비스 인스턴스
let audioService: AudioService;
let sttService: STTService;
let claudeService: ClaudeService;
let topicRepository: TopicRepository;

// 녹음 상태 관리
let isRecording = false;
let recordingStartTime: number | null = null;

export function registerTopicHandlers(): void {
  // 서비스 초기화
  audioService = new AudioService();
  sttService = new STTService();
  claudeService = new ClaudeService();
  topicRepository = new TopicRepository(getDatabase());

  // IPC 핸들러 등록
  ipcMain.handle('start-recording', handleStartRecording);
  ipcMain.handle('stop-recording', handleStopRecording);
  ipcMain.handle('transcribe-audio', handleTranscribeAudio);
  ipcMain.handle('generate-topic', handleGenerateTopic);
  ipcMain.handle('save-topic', handleSaveTopic);
  ipcMain.handle('get-active-topic', handleGetActiveTopic);
}

async function handleStartRecording(): Promise<IPCResponse<void>> {
  try {
    if (isRecording) {
      return {
        success: false,
        error: '이미 녹음 중입니다.',
      };
    }

    isRecording = true;
    recordingStartTime = Date.now();

    return { success: true };
  } catch (error) {
    isRecording = false;
    recordingStartTime = null;

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '녹음 시작에 실패했습니다.',
    };
  }
}

async function handleStopRecording(
  _event: IpcMainInvokeEvent,
  audioData: Uint8Array | Buffer
): Promise<IPCResponse<RecordingResult>> {
  try {
    if (!isRecording) {
      return {
        success: false,
        error: '녹음 중이 아닙니다.',
      };
    }

    const duration = recordingStartTime ? (Date.now() - recordingStartTime) / 1000 : 0;

    // 최소 1초 이상 녹음 확인
    if (duration < 1) {
      return {
        success: false,
        error: '최소 1초 이상 녹음해주세요.',
      };
    }

    // Uint8Array를 Buffer로 변환 (렌더러에서 Uint8Array로 전송됨)
    const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);

    const filePath = await audioService.saveRecording(audioBuffer, 'recording.m4a');

    isRecording = false;
    recordingStartTime = null;

    return {
      success: true,
      data: {
        filePath,
        duration,
      },
    };
  } catch (error) {
    isRecording = false;
    recordingStartTime = null;

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: '녹음 중지에 실패했습니다.',
    };
  }
}

async function handleTranscribeAudio(
  _event: IpcMainInvokeEvent,
  args: TranscribeArgs
): Promise<IPCResponse<STTResult>> {
  try {
    const result = await sttService.transcribeAudio(args.filePath, args.language);

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
      error: '음성 인식에 실패했습니다.',
    };
  }
}

async function handleGenerateTopic(
  _event: IpcMainInvokeEvent,
  args: GenerateTopicArgs
): Promise<IPCResponse<TopicGenerationResult>> {
  try {
    const result = await claudeService.generateEnglishScript(args.koreanText, args.cefrLevel);

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
      error: 'AI 영어 변환에 실패했습니다.',
    };
  }
}

async function handleSaveTopic(
  _event: IpcMainInvokeEvent,
  args: SaveTopicArgs
): Promise<IPCResponse<SaveTopicResult>> {
  try {
    const topicId = await topicRepository.create({
      title: args.title,
      koreanContent: args.koreanContent,
      englishContent: args.englishContent,
      cefrLevel: args.cefrLevel,
      keywords: args.keywords,
      recordingPath: args.recordingPath,
      weekStartDate: new Date(),
    });

    // 새로운 토픽을 활성화
    await topicRepository.setActive(topicId);

    return {
      success: true,
      data: { topicId },
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
      error: '토픽 저장에 실패했습니다.',
    };
  }
}

async function handleGetActiveTopic(): Promise<IPCResponse<Topic | null>> {
  try {
    const topic = await topicRepository.getActiveTopic();

    return {
      success: true,
      data: topic,
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
      error: '활성 토픽 조회에 실패했습니다.',
    };
  }
}

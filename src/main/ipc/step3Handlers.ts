import { ipcMain, IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import { AudioService } from '../services/AudioService';
import { STTService } from '../services/STTService';
import { TextNormalizationService } from '../services/TextNormalizationService';
import { AppError } from '../errors/AppError';
import {
  IPCResponse,
  RecordingFile,
  TranscribeRetellingResult,
  RetellingTextsResult,
  RetellingHistoryItem,
  GetRetellingHistoryArgs,
} from '../database/models';
import { getDatabase } from '../database/db';

// Service instances
let audioService: AudioService;
let sttService: STTService;
let textNormalizationService: TextNormalizationService;

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
  sttService = new STTService();
  textNormalizationService = new TextNormalizationService();

  // Recording handlers
  ipcMain.handle('start-recording-step3', handleStartRecordingStep3);
  ipcMain.handle('stop-recording-step3', handleStopRecordingStep3);
  ipcMain.handle('list-recordings-step3', handleListRecordingsStep3);
  ipcMain.handle('delete-recording-step3', handleDeleteRecordingStep3);

  // Retelling handlers (녹음 + STT 변환 + DB 저장)
  ipcMain.handle('transcribe-retelling', handleTranscribeRetelling);
  ipcMain.handle('get-retelling-texts', handleGetRetellingTexts);
  ipcMain.handle('get-retelling-history', handleGetRetellingHistory);
  ipcMain.handle('delete-retellings', handleDeleteRetellings);
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

// ==================== Retelling Handlers (녹음 + STT + DB) ====================

interface TranscribeRetellingArgs {
  topicId: number;
  duration: 3 | 2 | 1;
  audioData: Uint8Array;
  actualDuration?: number;
}

interface GetRetellingTextsArgs {
  topicId: number;
}

/**
 * 녹음 파일 저장 + STT 변환 + DB 저장을 한번에 처리
 */
async function handleTranscribeRetelling(
  _event: IpcMainInvokeEvent,
  args: TranscribeRetellingArgs
): Promise<IPCResponse<TranscribeRetellingResult>> {
  try {
    const { topicId, duration, audioData, actualDuration = 0 } = args;

    // 1. 녹음 파일 저장
    const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);

    const filePath = await audioService.saveRecordingStep3(audioBuffer, duration);

    // 2. STT 변환
    let transcribedText = '';
    try {
      const sttResult = await sttService.transcribeAudio(filePath, 'en');
      transcribedText = sttResult.text || '';

      // 3. STT 후처리: 구두점/포맷팅 교정
      if (transcribedText) {
        try {
          transcribedText = await textNormalizationService.normalizeText(transcribedText);
        } catch (normError) {
          console.error('[Step3] Text normalization failed (using raw STT):', normError);
          // 정규화 실패해도 원본 STT 텍스트 사용
        }
      }
    } catch (sttError) {
      console.error('STT 변환 실패 (녹음은 저장됨):', sttError);
      // STT 실패해도 녹음은 저장되었으므로 계속 진행
    }

    // 4. DB에 리텔링 저장 (기존 것이 있으면 업데이트)
    // audio_path는 null로 저장 (STT 변환 후 녹음 파일은 삭제됨)
    const db = getDatabase();
    const existingRetelling = db
      .prepare(
        'SELECT id FROM retellings WHERE topic_id = ? AND duration = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(topicId, duration) as { id: number } | undefined;

    let retellingId: number;
    if (existingRetelling) {
      // 업데이트
      db.prepare(
        'UPDATE retellings SET audio_path = ?, transcribed_text = ?, actual_duration = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(null, transcribedText, actualDuration, existingRetelling.id);
      retellingId = existingRetelling.id;
    } else {
      // 새로 생성
      const result = db
        .prepare(
          'INSERT INTO retellings (topic_id, duration, audio_path, transcribed_text, actual_duration) VALUES (?, ?, ?, ?, ?)'
        )
        .run(topicId, duration, null, transcribedText, actualDuration);
      retellingId = result.lastInsertRowid as number;
    }

    // 5. STT 변환 완료 후 녹음 파일 삭제 (디스크 공간 절약)
    fs.promises.unlink(filePath).catch((err) => {
      console.error('[Step3] Failed to delete recording after STT:', filePath, err);
    });

    return {
      success: true,
      data: {
        filePath: '', // 파일이 삭제되었으므로 빈 문자열 반환
        duration,
        actualDuration,
        transcribedText,
        retellingId,
      },
    };
  } catch (error) {
    console.error('Retelling transcribe error:', error);
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.userMessage,
        errorCode: error.code,
      };
    }
    return {
      success: false,
      error: '리텔링 저장에 실패했습니다.',
    };
  }
}

/**
 * 특정 토픽의 3분/2분/1분 리텔링 텍스트를 조회하고 포맷팅하여 반환
 */
async function handleGetRetellingTexts(
  _event: IpcMainInvokeEvent,
  args: GetRetellingTextsArgs
): Promise<IPCResponse<RetellingTextsResult>> {
  try {
    const { topicId } = args;
    const db = getDatabase();

    // 각 duration별 최신 리텔링 조회
    const retellings = db
      .prepare(
        `SELECT duration, transcribed_text
         FROM retellings
         WHERE topic_id = ? AND transcribed_text IS NOT NULL AND transcribed_text != ''
         ORDER BY duration DESC, created_at DESC`
      )
      .all(topicId) as { duration: number; transcribed_text: string }[];

    // duration별로 그룹화 (최신 것만)
    const textByDuration: Record<number, string> = {};
    for (const r of retellings) {
      if (!textByDuration[r.duration]) {
        textByDuration[r.duration] = r.transcribed_text;
      }
    }

    const threeMin = textByDuration[3] || null;
    const twoMin = textByDuration[2] || null;
    const oneMin = textByDuration[1] || null;

    // 구분자를 포함한 포맷팅된 텍스트 생성
    const sections: string[] = [];
    if (threeMin) {
      sections.push(`----3분 리텔링 시 내용----\n${threeMin}`);
    }
    if (twoMin) {
      sections.push(`----2분 리텔링 시 내용----\n${twoMin}`);
    }
    if (oneMin) {
      sections.push(`----1분 리텔링 시 내용----\n${oneMin}`);
    }

    const formattedText = sections.join('\n\n');

    return {
      success: true,
      data: {
        threeMin,
        twoMin,
        oneMin,
        formattedText,
      },
    };
  } catch (error) {
    console.error('Get retelling texts error:', error);
    return {
      success: false,
      error: '리텔링 텍스트 조회에 실패했습니다.',
    };
  }
}

interface DeleteRetellingsArgs {
  topicId: number;
}

/**
 * 특정 토픽의 모든 리텔링 삭제 (다시 시작 시 사용)
 */
async function handleDeleteRetellings(
  _event: IpcMainInvokeEvent,
  args: DeleteRetellingsArgs
): Promise<IPCResponse<void>> {
  try {
    const { topicId } = args;
    const db = getDatabase();

    db.prepare('DELETE FROM retellings WHERE topic_id = ?').run(topicId);

    return { success: true };
  } catch (error) {
    console.error('Delete retellings error:', error);
    return {
      success: false,
      error: '리텔링 삭제에 실패했습니다.',
    };
  }
}

/**
 * 특정 토픽의 리텔링 히스토리 조회
 */
async function handleGetRetellingHistory(
  _event: IpcMainInvokeEvent,
  args: GetRetellingHistoryArgs
): Promise<IPCResponse<RetellingHistoryItem[]>> {
  try {
    const { topicId, duration } = args;
    const db = getDatabase();

    let query = `
      SELECT id, duration, created_at, actual_duration, transcribed_text
      FROM retellings
      WHERE topic_id = ?
    `;

    const params: (number | string)[] = [topicId];

    if (duration !== undefined) {
      query += ' AND duration = ?';
      params.push(duration);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = db.prepare(query).all(...params) as {
      id: number;
      duration: number;
      created_at: string;
      actual_duration: number | null;
      transcribed_text: string | null;
    }[];

    const history: RetellingHistoryItem[] = rows.map((row) => ({
      id: row.id,
      duration: row.duration as 3 | 2 | 1,
      createdAt: new Date(row.created_at),
      actualDuration: row.actual_duration,
      transcribedText: row.transcribed_text,
    }));

    return {
      success: true,
      data: history,
    };
  } catch (error) {
    console.error('Get retelling history error:', error);
    return {
      success: false,
      error: '히스토리 조회에 실패했습니다.',
    };
  }
}

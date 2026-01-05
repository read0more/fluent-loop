import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppError, ErrorCode } from '../errors/AppError';
import { RecordingFile } from '../database/models';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// ffmpeg 경로 설정
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface IAudioService {
  getRecordingPath(filename: string, step?: 1 | 2): string;
  saveRecording(buffer: Buffer, filename: string, step?: 1 | 2): Promise<string>;
  saveRecordingStep2(buffer: Buffer, filename: string, customPath?: string): Promise<string>;
  deleteRecording(filePath: string): Promise<void>;
  listRecordings(step: 1 | 2, customPath?: string): Promise<RecordingFile[]>;
  validateSavePath(path: string): Promise<boolean>;
  cleanupTempFiles(olderThanDays: number): Promise<void>;
}

export class AudioService implements IAudioService {
  private readonly step1Dir: string;
  private readonly step2Dir: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.step1Dir = path.join(userDataPath, 'data', 'recordings', 'step1');
    this.step2Dir = path.join(userDataPath, 'data', 'recordings', 'step2');

    // 디렉토리 생성
    if (!fs.existsSync(this.step1Dir)) {
      fs.mkdirSync(this.step1Dir, { recursive: true });
    }
    if (!fs.existsSync(this.step2Dir)) {
      fs.mkdirSync(this.step2Dir, { recursive: true });
    }
  }

  getRecordingPath(filename: string, step: 1 | 2 = 1): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');

    const ext = path.extname(filename) || '.m4a';
    const finalFilename = `${timestamp}${ext}`;

    const recordingsDir = step === 1 ? this.step1Dir : this.step2Dir;
    return path.join(recordingsDir, finalFilename);
  }

  async saveRecording(buffer: Buffer, filename: string, step: 1 | 2 = 1): Promise<string> {
    try {
      const filePath = this.getRecordingPath(filename, step);

      await fs.promises.writeFile(filePath, buffer);

      // 파일 생성 확인
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) {
        throw new Error('File size is 0');
      }

      return filePath;
    } catch (error) {
      throw new AppError(
        ErrorCode.RECORDING_FAILED,
        'Failed to save recording',
        '녹음 파일 저장에 실패했습니다.',
        error as Error
      );
    }
  }

  async saveRecordingStep2(buffer: Buffer, filename: string, customPath?: string): Promise<string> {
    try {
      // 저장 경로 결정
      let targetDir: string;

      if (customPath) {
        // 사용자 지정 경로 검증
        const isValid = await this.validateSavePath(customPath);
        if (!isValid) {
          console.warn(`Custom path ${customPath} is invalid, falling back to default`);
          targetDir = this.step2Dir;
        } else {
          targetDir = customPath;
        }
      } else {
        targetDir = this.step2Dir;
      }

      // 파일명 생성
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');

      const tempFilename = `${timestamp}_temp.webm`;
      const finalFilename = `${timestamp}.m4a`;
      const tempFilePath = path.join(targetDir, tempFilename);
      const finalFilePath = path.join(targetDir, finalFilename);

      // 임시 파일 저장
      await fs.promises.writeFile(tempFilePath, buffer);

      // 파일 생성 확인
      const stats = await fs.promises.stat(tempFilePath);
      if (stats.size === 0) {
        throw new Error('File size is 0');
      }

      // ffmpeg로 변환 (duration 메타데이터 수정)
      await this.convertWithFfmpeg(tempFilePath, finalFilePath);

      // 임시 파일 삭제
      await fs.promises.unlink(tempFilePath).catch(() => {});

      return finalFilePath;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EACCES') {
        throw new AppError(
          ErrorCode.RECORDING_PATH_INVALID,
          'Permission denied',
          '저장 경로에 접근할 수 없습니다. 권한을 확인하거나 다른 경로를 선택해주세요.'
        );
      }

      if (nodeError.code === 'ENOSPC') {
        throw new AppError(
          ErrorCode.RECORDING_SAVE_FAILED,
          'No disk space',
          '디스크 공간이 부족합니다.'
        );
      }

      throw new AppError(
        ErrorCode.RECORDING_SAVE_FAILED,
        'Failed to save recording',
        '녹음 파일 저장에 실패했습니다.',
        error instanceof Error ? error : undefined
      );
    }
  }

  async listRecordings(step: 1 | 2, customPath?: string): Promise<RecordingFile[]> {
    try {
      const targetDir = customPath || (step === 1 ? this.step1Dir : this.step2Dir);

      if (!fs.existsSync(targetDir)) {
        return [];
      }

      const files = await fs.promises.readdir(targetDir);
      const recordings: RecordingFile[] = [];

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.isFile()) {
          recordings.push({
            fileName: file,
            filePath,
            createdAt: stats.birthtime,
            size: stats.size,
          });
        }
      }

      // 최신순 정렬
      recordings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return recordings;
    } catch (error) {
      console.error('Failed to list recordings:', error);
      return [];
    }
  }

  async validateSavePath(targetPath: string): Promise<boolean> {
    try {
      // 경로 존재 확인
      if (!fs.existsSync(targetPath)) {
        // 경로 생성 시도
        await fs.promises.mkdir(targetPath, { recursive: true });
      }

      // 쓰기 권한 확인
      await fs.promises.access(targetPath, fs.constants.W_OK);

      return true;
    } catch (error) {
      console.error(`Path validation failed for ${targetPath}:`, error);
      return false;
    }
  }

  async deleteRecording(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.RECORDING_FAILED,
        'Failed to delete recording',
        '녹음 파일 삭제에 실패했습니다.',
        error as Error
      );
    }
  }

  async cleanupTempFiles(olderThanDays: number): Promise<void> {
    try {
      // step1과 step2 모두 정리
      const dirs = [this.step1Dir, this.step2Dir];
      const now = Date.now();
      const maxAge = olderThanDays * 24 * 60 * 60 * 1000;

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;

        const files = await fs.promises.readdir(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.promises.stat(filePath);

          if (now - stats.mtimeMs > maxAge) {
            await fs.promises.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
      // 정리 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  private convertWithFfmpeg(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('aac')
        .audioBitrate('128k')
        .audioChannels(1)
        .audioFrequency(44100)
        .output(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg error:', err);
          reject(
            new AppError(
              ErrorCode.RECORDING_SAVE_FAILED,
              'FFmpeg conversion failed',
              '녹음 파일 변환에 실패했습니다.',
              err
            )
          );
        })
        .run();
    });
  }
}

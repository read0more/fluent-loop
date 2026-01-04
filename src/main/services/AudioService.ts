import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppError, ErrorCode } from '../errors/AppError';

export interface IAudioService {
  getRecordingPath(filename: string): string;
  saveRecording(buffer: Buffer, filename: string): Promise<string>;
  deleteRecording(filePath: string): Promise<void>;
  cleanupTempFiles(olderThanDays: number): Promise<void>;
}

export class AudioService implements IAudioService {
  private readonly recordingsDir: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.recordingsDir = path.join(userDataPath, 'data', 'recordings', 'step1');

    // 디렉토리 생성
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  getRecordingPath(filename: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');

    const ext = path.extname(filename) || '.m4a';
    const finalFilename = `${timestamp}${ext}`;

    return path.join(this.recordingsDir, finalFilename);
  }

  async saveRecording(buffer: Buffer, filename: string): Promise<string> {
    try {
      const filePath = this.getRecordingPath(filename);

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
      const files = await fs.promises.readdir(this.recordingsDir);
      const now = Date.now();
      const maxAge = olderThanDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.recordingsDir, file);
        const stats = await fs.promises.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
      // 정리 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }
}

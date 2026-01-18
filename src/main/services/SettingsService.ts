import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { AppSettings } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

export interface ISettingsService {
  getSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<AppSettings>;
  resetToDefaults(): Promise<void>;
}

export class SettingsService implements ISettingsService {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async getSetting(key: string): Promise<string | null> {
    try {
      const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;

      return row ? row.value : null;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to get setting',
        '설정 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  async saveSetting(key: string, value: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      stmt.run(key, value);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to save setting',
        '설정 저장에 실패했습니다.',
        error as Error
      );
    }
  }

  async getAllSettings(): Promise<AppSettings> {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM settings');
      const rows = stmt.all() as Array<{ key: string; value: string }>;

      const settings: AppSettings = {
        ttsProvider: 'supertonic',
        ttsVoiceId: 'en-US-AriaNeural',
        ttsVoiceIdUser: 'en-US-GuyNeural',
        supertonicVoice: 'M4',
        recordingSavePath: path.join(app.getPath('userData'), 'data', 'recordings', 'step2'),
        sttUseGpu: 'false',
      };

      for (const row of rows) {
        settings[row.key] = row.value;
      }

      // recordingSavePath가 빈 문자열이면 기본값 사용
      if (!settings.recordingSavePath || settings.recordingSavePath === '') {
        settings.recordingSavePath = path.join(
          app.getPath('userData'),
          'data',
          'recordings',
          'step2'
        );
      }

      return settings;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to get all settings',
        '설정 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  async resetToDefaults(): Promise<void> {
    try {
      const defaultSettings = {
        ttsProvider: 'supertonic',
        ttsVoiceId: 'en-US-AriaNeural',
        ttsVoiceIdUser: 'en-US-GuyNeural',
        supertonicVoice: 'M4',
        recordingSavePath: '',
        sttUseGpu: 'false',
      };

      const stmt = this.db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      for (const [key, value] of Object.entries(defaultSettings)) {
        stmt.run(key, value);
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to reset settings',
        '설정 초기화에 실패했습니다.',
        error as Error
      );
    }
  }
}

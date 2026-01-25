import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { initializeDatabase } from './schema';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // 데이터 디렉토리 경로 설정
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');

  // 디렉토리 생성
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'app.db');

  // SQLite 연결
  dbInstance = new Database(dbPath, { verbose: console.log });

  // 테이블 초기화
  initializeDatabase(dbInstance);

  // 마이그레이션: actual_duration 컬럼 추가
  try {
    const columns = dbInstance.pragma("table_info('retellings')") as { name: string }[];
    const hasActualDuration = columns.some((col) => col.name === 'actual_duration');

    if (!hasActualDuration) {
      console.log('Running migration: Add actual_duration to retellings');
      dbInstance.exec('ALTER TABLE retellings ADD COLUMN actual_duration INTEGER;');
    }
  } catch (error) {
    // SQLite 에러 코드를 확인하여 적절히 처리
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 컬럼이 이미 존재하는 경우는 무시 (중복 마이그레이션)
    if (errorMessage.includes('duplicate column name')) {
      console.log('Migration skipped: actual_duration column already exists');
    } else {
      // 다른 에러는 경고 후 계속 진행 (graceful degradation)
      // 하지만 DB 접근 자체가 실패한 경우는 심각한 에러이므로 로그 기록
      console.error('Migration warning:', errorMessage);
      console.warn('App will continue but retelling history feature may not work properly');
    }
  }

  // 마이그레이션: ttsProvider, supertonicVoice 설정 추가
  try {
    const stmt = dbInstance.prepare('SELECT key FROM settings WHERE key = ?');
    const hasTtsProvider = stmt.get('ttsProvider');
    const hasSupertonicVoice = stmt.get('supertonicVoice');

    if (!hasTtsProvider) {
      console.log('Running migration: Add ttsProvider to settings');
      dbInstance
        .prepare(
          `
        INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts')
      `
        )
        .run();
    }

    if (!hasSupertonicVoice) {
      console.log('Running migration: Add supertonicVoice to settings');
      dbInstance
        .prepare(
          `
        INSERT OR IGNORE INTO settings (key, value) VALUES ('supertonicVoice', 'M4')
      `
        )
        .run();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Settings migration warning:', errorMessage);
    console.warn('App will continue but TTS settings may need manual configuration');
  }

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

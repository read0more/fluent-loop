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

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

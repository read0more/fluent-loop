import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase, insertDefaultSettingsSQL } from '../schema';

describe('Database Schema Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory DB for testing
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('TC-DB-001: DB 초기화 시 ttsProvider 기본값 생성', () => {
    it('should create ttsProvider record with edge-tts default value', () => {
      // Arrange & Act
      initializeDatabase(db);

      // Assert
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ttsProvider') as
        | { value: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.value).toBe('edge-tts');
    });
  });

  describe('TC-DB-002: DB 초기화 시 supertonicVoice 기본값 생성', () => {
    it('should create supertonicVoice record with M4 default value', () => {
      // Arrange & Act
      initializeDatabase(db);

      // Assert
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('supertonicVoice') as
        | { value: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.value).toBe('M4');
    });
  });

  describe('TC-DB-003: 기존 설정과 중복되지 않도록 INSERT OR IGNORE 작동', () => {
    it('should not overwrite existing ttsProvider setting', () => {
      // Arrange
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Insert existing setting
      db.prepare("INSERT INTO settings (key, value) VALUES ('ttsProvider', 'supertonic')").run();

      // Act
      db.exec(insertDefaultSettingsSQL);

      // Assert
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ttsProvider') as
        | { value: string }
        | undefined;
      expect(row?.value).toBe('supertonic'); // Should remain unchanged
    });
  });

  describe('TC-DB-EXTRA: Verify all default settings are created', () => {
    it('should create all 5 default settings including ttsProvider and supertonicVoice', () => {
      // Arrange & Act
      initializeDatabase(db);

      // Assert
      const rows = db.prepare('SELECT key FROM settings').all() as Array<{ key: string }>;
      const keys = rows.map((r) => r.key);

      // Expected: ttsVoiceId, ttsVoiceIdUser, recordingSavePath, ttsProvider, supertonicVoice
      expect(keys).toContain('ttsProvider');
      expect(keys).toContain('supertonicVoice');
      expect(keys).toContain('ttsVoiceId');
      expect(keys).toContain('ttsVoiceIdUser');
      expect(keys).toContain('recordingSavePath');
      expect(keys.length).toBeGreaterThanOrEqual(5);
    });
  });
});

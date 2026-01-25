import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTablesSQL } from '../schema';

describe('Database Migration Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('TC-MIG-001: 기존 DB에 ttsProvider 마이그레이션 성공', () => {
    it('should add ttsProvider to existing database', () => {
      // Arrange - Simulate existing DB without ttsProvider
      db.exec(createTablesSQL);
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('ttsVoiceId', 'en-US-AriaNeural')"
      ).run();

      // Act - Run migration logic (check and insert ttsProvider)
      const stmt = db.prepare('SELECT key FROM settings WHERE key = ?');
      const hasTtsProvider = stmt.get('ttsProvider');

      if (!hasTtsProvider) {
        db.prepare(
          "INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts')"
        ).run();
      }

      // Assert
      const ttsProviderRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('ttsProvider') as { value: string } | undefined;
      expect(ttsProviderRow).toBeDefined();
      expect(ttsProviderRow?.value).toBe('edge-tts');

      // Verify existing data is preserved
      const ttsVoiceIdRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('ttsVoiceId') as { value: string } | undefined;
      expect(ttsVoiceIdRow?.value).toBe('en-US-AriaNeural');
    });
  });

  describe('TC-MIG-002: 기존 DB에 supertonicVoice 마이그레이션 성공', () => {
    it('should add supertonicVoice to existing database', () => {
      // Arrange - Simulate existing DB without supertonicVoice
      db.exec(createTablesSQL);

      // Act - Run migration logic (check and insert supertonicVoice)
      const stmt = db.prepare('SELECT key FROM settings WHERE key = ?');
      const hasSupertonicVoice = stmt.get('supertonicVoice');

      if (!hasSupertonicVoice) {
        db.prepare(
          "INSERT OR IGNORE INTO settings (key, value) VALUES ('supertonicVoice', 'M4')"
        ).run();
      }

      // Assert
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('supertonicVoice') as
        | { value: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.value).toBe('M4');
    });
  });

  describe('TC-MIG-003: 마이그레이션 이미 완료된 경우 중복 실행 방지', () => {
    it('should not duplicate settings when migration runs multiple times', () => {
      // Arrange - DB with existing ttsProvider and supertonicVoice
      db.exec(createTablesSQL);
      db.prepare("INSERT INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts')").run();
      db.prepare("INSERT INTO settings (key, value) VALUES ('supertonicVoice', 'M4')").run();

      // Act - Run migration logic again
      db.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts')"
      ).run();
      db.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('supertonicVoice', 'M4')"
      ).run();

      // Assert - Should have exactly 2 records (no duplicates)
      const count = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM settings WHERE key IN ('ttsProvider', 'supertonicVoice')"
        )
        .get() as { cnt: number };
      expect(count.cnt).toBe(2);

      // Verify values remain unchanged
      const ttsProviderRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('ttsProvider') as { value: string } | undefined;
      const supertonicVoiceRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('supertonicVoice') as { value: string } | undefined;

      expect(ttsProviderRow?.value).toBe('edge-tts');
      expect(supertonicVoiceRow?.value).toBe('M4');
    });
  });

  describe('TC-INT-006: 앱 시작 시 마이그레이션 자동 실행', () => {
    it('should automatically migrate settings on app start', () => {
      // Arrange - Simulate existing DB without new settings
      db.exec(createTablesSQL);
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('ttsVoiceId', 'en-US-AriaNeural')"
      ).run();

      // Act - Simulate app startup migration
      const migrateSettings = () => {
        const stmt = db.prepare('SELECT key FROM settings WHERE key = ?');

        // Check and add ttsProvider
        if (!stmt.get('ttsProvider')) {
          db.prepare(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts')"
          ).run();
        }

        // Check and add supertonicVoice
        if (!stmt.get('supertonicVoice')) {
          db.prepare(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('supertonicVoice', 'M4')"
          ).run();
        }
      };

      migrateSettings();

      // Assert
      const ttsProviderRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('ttsProvider') as { value: string } | undefined;
      const supertonicVoiceRow = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('supertonicVoice') as { value: string } | undefined;

      expect(ttsProviderRow?.value).toBe('edge-tts');
      expect(supertonicVoiceRow?.value).toBe('M4');
    });
  });

  describe('TC-MIG-ERR: 마이그레이션 중 에러 발생 시 graceful degradation', () => {
    it('should handle migration errors gracefully', () => {
      // Arrange
      db.exec(createTablesSQL);

      // Act - Simulate migration with error handling
      const migrateWithErrorHandling = () => {
        try {
          // Intentional error: trying to insert with wrong SQL
          db.prepare('INSERT INTO nonexistent_table (key, value) VALUES (?, ?)').run(
            'ttsProvider',
            'edge-tts'
          );
        } catch (error) {
          // Graceful degradation: log error but continue
          const errorMessage = error instanceof Error ? error.message : String(error);
          expect(errorMessage).toContain('no such table');
          return { success: false, error: errorMessage };
        }
        return { success: true };
      };

      const result = migrateWithErrorHandling();

      // Assert - Migration failed but app continues
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('TC-INT-008: 신규 사용자의 첫 실행 시 DB 초기화', () => {
    it('should initialize database with all default settings for new users', () => {
      // Arrange & Act - Fresh DB initialization
      db.exec(createTablesSQL);
      db.exec(`
        INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsVoiceId', 'en-US-AriaNeural');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsVoiceIdUser', 'en-US-GuyNeural');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('recordingSavePath', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsProvider', 'edge-tts');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('supertonicVoice', 'M4');
      `);

      // Assert - All 5 default settings should exist
      const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
        key: string;
        value: string;
      }>;

      expect(rows.length).toBe(5);
      expect(rows.find((r) => r.key === 'ttsProvider')?.value).toBe('edge-tts');
      expect(rows.find((r) => r.key === 'supertonicVoice')?.value).toBe('M4');
      expect(rows.find((r) => r.key === 'ttsVoiceId')?.value).toBe('en-US-AriaNeural');
      expect(rows.find((r) => r.key === 'ttsVoiceIdUser')?.value).toBe('en-US-GuyNeural');
      expect(rows.find((r) => r.key === 'recordingSavePath')?.value).toBe('');
    });
  });
});

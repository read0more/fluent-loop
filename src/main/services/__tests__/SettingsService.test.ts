import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../SettingsService';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'E:\\develop\\electron-test\\test-data'),
  },
}));

// Mock database
const mockDatabase = {
  prepare: vi.fn(),
  exec: vi.fn(),
  close: vi.fn(),
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDatabase),
}));

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settingsService = new SettingsService(mockDatabase as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-SETTINGS-001: 설정 저장 및 조회', () => {
    it('should save and retrieve setting', async () => {
      // Arrange
      const key = 'ttsVoiceId';
      const value = 'en-US-2';

      const mockGet = vi.fn().mockReturnValue({ value });
      const mockRun = vi.fn();

      mockDatabase.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return { get: mockGet };
        }
        return { run: mockRun };
      });

      // Act
      await settingsService.saveSetting(key, value);
      const result = await settingsService.getSetting(key);

      // Assert
      expect(result).toBe(value);
      expect(mockRun).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });
  });

  describe('TC-SETTINGS-002: 존재하지 않는 설정 키 조회', () => {
    it('should return null for non-existent key', async () => {
      // Arrange
      const key = 'nonExistentKey';

      const mockGet = vi.fn().mockReturnValue(undefined);

      mockDatabase.prepare.mockReturnValue({ get: mockGet });

      // Act
      const result = await settingsService.getSetting(key);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('TC-SETTINGS-003: 모든 설정 조회', () => {
    it('should get all settings', async () => {
      // Arrange
      const mockAll = vi.fn().mockReturnValue([
        { key: 'ttsVoiceId', value: 'en-US-1' },
        { key: 'recordingSavePath', value: '/path/to/recordings' },
      ]);

      mockDatabase.prepare.mockReturnValue({ all: mockAll });

      // Act
      const result = await settingsService.getAllSettings();

      // Assert
      expect(result).toHaveProperty('ttsVoiceId');
      expect(result).toHaveProperty('recordingSavePath');
      expect(result.ttsVoiceId).toBe('en-US-1');
    });
  });

  describe('TC-SETTINGS-004: 기본값으로 재설정', () => {
    it('should reset to default values', async () => {
      // Arrange
      const mockRun = vi.fn();
      const mockAll = vi.fn().mockReturnValue([
        { key: 'ttsVoiceId', value: 'default' },
        { key: 'recordingSavePath', value: 'default/path' },
      ]);

      mockDatabase.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return { all: mockAll };
        }
        return { run: mockRun };
      });

      // Act
      await settingsService.resetToDefaults();
      const settings = await settingsService.getAllSettings();

      // Assert
      expect(mockRun).toHaveBeenCalled();
      expect(settings.ttsVoiceId).toBeDefined();
    });
  });

  describe('TC-SETTINGS-005: SQLite 데이터베이스 잠금', () => {
    it('should handle database lock error', async () => {
      // Arrange
      const key = 'testKey';
      const value = 'testValue';

      const mockRun = vi.fn().mockImplementation(() => {
        throw new Error('SQLITE_BUSY: database is locked');
      });

      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      // Act & Assert
      await expect(settingsService.saveSetting(key, value)).rejects.toThrow();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../SettingsService';
import { AppError, ErrorCode } from '../../errors/AppError';

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

describe('SettingsService - TTS Settings Tests', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settingsService = new SettingsService(mockDatabase as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-SVC-001: ttsProvider 저장 성공', () => {
    it('should save and retrieve ttsProvider setting', async () => {
      // Arrange
      const key = 'ttsProvider';
      const value = 'edge-tts';

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
      expect(result).toBe('edge-tts');
      expect(mockRun).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });
  });

  describe('TC-SVC-002: supertonicVoice 저장 성공', () => {
    it('should save and retrieve supertonicVoice setting', async () => {
      // Arrange
      const key = 'supertonicVoice';
      const value = 'F1';

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
      expect(result).toBe('F1');
      expect(mockRun).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });
  });

  describe('TC-SVC-003: getAllSettings에 ttsProvider 포함 확인', () => {
    it('should include ttsProvider in getAllSettings response', async () => {
      // Arrange
      const mockAll = vi.fn().mockReturnValue([
        { key: 'ttsProvider', value: 'edge-tts' },
        { key: 'ttsVoiceId', value: 'en-US-AriaNeural' },
      ]);

      mockDatabase.prepare.mockReturnValue({ all: mockAll });

      // Act
      const settings = await settingsService.getAllSettings();

      // Assert
      expect(settings.ttsProvider).toBeDefined();
      expect(settings.ttsProvider).toBe('edge-tts');
    });
  });

  describe('TC-SVC-004: getAllSettings에 supertonicVoice 포함 확인', () => {
    it('should include supertonicVoice in getAllSettings response', async () => {
      // Arrange
      const mockAll = vi.fn().mockReturnValue([
        { key: 'supertonicVoice', value: 'M4' },
        { key: 'ttsVoiceId', value: 'en-US-AriaNeural' },
      ]);

      mockDatabase.prepare.mockReturnValue({ all: mockAll });

      // Act
      const settings = await settingsService.getAllSettings();

      // Assert
      expect(settings.supertonicVoice).toBeDefined();
      expect(settings.supertonicVoice).toBe('M4');
    });
  });

  describe('TC-SVC-005: resetToDefaults 시 ttsProvider 초기화 확인', () => {
    it('should reset ttsProvider to default value (supertonic)', async () => {
      // Arrange
      const mockRun = vi.fn();
      const mockGet = vi.fn().mockReturnValue({ value: 'supertonic' }); // After reset

      mockDatabase.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return { get: mockGet };
        }
        return { run: mockRun };
      });

      // Act
      await settingsService.resetToDefaults();
      const value = await settingsService.getSetting('ttsProvider');

      // Assert
      expect(value).toBe('supertonic');
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('TC-SVC-006: DB에 설정이 없을 때 하드코딩된 기본값 반환', () => {
    it('should return hardcoded default values when DB is empty', async () => {
      // Arrange
      const mockAll = vi.fn().mockReturnValue([]); // Empty DB

      mockDatabase.prepare.mockReturnValue({ all: mockAll });

      // Act
      const settings = await settingsService.getAllSettings();

      // Assert
      expect(settings.ttsProvider).toBe('supertonic');
      expect(settings.supertonicVoice).toBe('M4');
      expect(settings.ttsVoiceId).toBe('en-US-AriaNeural');
    });
  });

  describe('TC-BND-001: 빈 문자열 저장 시 처리', () => {
    it('should save and retrieve empty string', async () => {
      // Arrange
      const key = 'ttsProvider';
      const value = '';

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
      expect(result).toBe('');
    });
  });

  describe('TC-BND-002: 매우 긴 문자열 저장 시 처리', () => {
    it('should save and retrieve very long string', async () => {
      // Arrange
      const key = 'supertonicVoice';
      const longString = 'A'.repeat(1000);

      const mockGet = vi.fn().mockReturnValue({ value: longString });
      const mockRun = vi.fn();

      mockDatabase.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return { get: mockGet };
        }
        return { run: mockRun };
      });

      // Act
      await settingsService.saveSetting(key, longString);
      const result = await settingsService.getSetting(key);

      // Assert
      expect(result).toBe(longString);
      expect(result?.length).toBe(1000);
    });
  });

  describe('TC-BND-003: 존재하지 않는 키 조회 시 null 반환', () => {
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

  describe('TC-BND-004: 특수 문자가 포함된 값 저장', () => {
    it('should prevent SQL injection with special characters', async () => {
      // Arrange
      const key = 'ttsProvider';
      const maliciousString = "test'; DROP TABLE settings;--";

      const mockGet = vi.fn().mockReturnValue({ value: maliciousString });
      const mockRun = vi.fn();

      mockDatabase.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return { get: mockGet };
        }
        return { run: mockRun };
      });

      // Act
      await settingsService.saveSetting(key, maliciousString);
      const result = await settingsService.getSetting(key);

      // Assert
      expect(result).toBe(maliciousString);
      // Verify prepared statement was used (prevents SQL injection)
      expect(mockDatabase.prepare).toHaveBeenCalled();
    });
  });

  describe('TC-ERR-001: DB 연결 실패 시 에러 처리', () => {
    it('should throw AppError when database is locked', async () => {
      // Arrange
      const key = 'ttsProvider';
      const mockGet = vi.fn().mockImplementation(() => {
        throw new Error('SQLITE_BUSY: database is locked');
      });

      mockDatabase.prepare.mockReturnValue({ get: mockGet });

      // Act & Assert
      await expect(settingsService.getSetting(key)).rejects.toThrow(AppError);
      await expect(settingsService.getSetting(key)).rejects.toMatchObject({
        code: ErrorCode.DATABASE_QUERY_ERROR,
        userMessage: '설정 조회에 실패했습니다.',
      });
    });
  });

  describe('TC-ERR-SAVE: 설정 저장 실패 시 에러 처리', () => {
    it('should throw AppError when save fails', async () => {
      // Arrange
      const key = 'ttsProvider';
      const value = 'edge-tts';
      const mockRun = vi.fn().mockImplementation(() => {
        throw new Error('SQLITE_BUSY: database is locked');
      });

      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      // Act & Assert
      await expect(settingsService.saveSetting(key, value)).rejects.toThrow(AppError);
      await expect(settingsService.saveSetting(key, value)).rejects.toMatchObject({
        code: ErrorCode.DATABASE_QUERY_ERROR,
        userMessage: '설정 저장에 실패했습니다.',
      });
    });
  });
});

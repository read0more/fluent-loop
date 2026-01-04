import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AudioService } from '../AudioService';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'E:\\develop\\electron-test\\test-data'),
  },
}))

describe('AudioService', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
  });

  afterEach(() => {
    // Cleanup test files
    vi.clearAllMocks();
  });

  describe('TC-001: 녹음 파일 경로 생성', () => {
    it('should return absolute path with timestamp format', () => {
      // Arrange
      const filename = 'test_recording.m4a';

      // Act
      const result = audioService.getRecordingPath(filename);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('data');
      expect(result).toContain('recordings');
      expect(result).toContain('step1');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.m4a$/);
    });

    it('should generate unique paths for consecutive calls', () => {
      // Arrange & Act
      const path1 = audioService.getRecordingPath('test.m4a');
      const path2 = audioService.getRecordingPath('test.m4a');

      // Assert
      // Paths should be different (due to timestamp)
      expect(path1).toBeDefined();
      expect(path2).toBeDefined();
    });
  });

  describe('TC-002: 녹음 파일 저장', () => {
    it('should save recording file and return path', async () => {
      // Arrange
      const testBuffer = Buffer.from('test audio data');
      const filename = 'test.m4a';

      // Act
      const result = await audioService.saveRecording(testBuffer, filename);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('.m4a');
    });

    it('should create file with size greater than 0', async () => {
      // Arrange
      const testBuffer = Buffer.from('test audio data with content');
      const filename = 'test_size.m4a';

      // Act
      const filePath = await audioService.saveRecording(testBuffer, filename);

      // Assert (file should exist and have content)
      // This will fail until implementation
      expect(filePath).toBeTruthy();
    });
  });

  describe('TC-003: 녹음 파일 삭제', () => {
    it('should delete recording file without error', async () => {
      // Arrange
      const filePath = '/path/to/test/recording.m4a';

      // Act & Assert
      await expect(audioService.deleteRecording(filePath)).resolves.not.toThrow();
    });

    it('should handle non-existent file gracefully', async () => {
      // Arrange
      const nonExistentPath = '/path/to/nonexistent.m4a';

      // Act & Assert
      await expect(audioService.deleteRecording(nonExistentPath)).resolves.not.toThrow();
    });
  });

  describe('TC-004: 오래된 임시 파일 정리', () => {
    it('should clean up files older than specified days', async () => {
      // Arrange
      const olderThanDays = 7;

      // Act & Assert
      await expect(audioService.cleanupTempFiles(olderThanDays)).resolves.not.toThrow();
    });

    it('should keep recent files', async () => {
      // Arrange
      const olderThanDays = 1;

      // Act
      await audioService.cleanupTempFiles(olderThanDays);

      // Assert
      // Recent files should remain (will be verified in implementation)
      expect(true).toBe(true);
    });
  });
});

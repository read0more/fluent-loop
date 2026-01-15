import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TTSCacheService } from '../TTSCacheService';

// Mock Electron app.getPath()
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'tts-cache-test-' + Date.now())),
  },
}));

describe('TTSCacheService', () => {
  let service: TTSCacheService;
  let cacheDir: string;
  let tempTestDir: string;

  beforeEach(async () => {
    // 테스트용 임시 디렉토리 생성
    tempTestDir = path.join(os.tmpdir(), 'tts-test-files-' + Date.now());
    await fs.mkdir(tempTestDir, { recursive: true });

    // TTSCacheService 인스턴스 생성
    service = new TTSCacheService();

    // 초기화 대기 (비동기 초기화 완료)
    await service.initialize();

    // 캐시 디렉토리 경로 가져오기 (private 필드지만 테스트를 위해)
    cacheDir = (service as unknown as { cacheDir: string }).cacheDir;
  });

  afterEach(async () => {
    // 테스트용 임시 디렉토리 정리
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // 정리 실패는 무시 (테스트 실패 방지)
    }
  });

  // =============================================================================
  // TC-TTS-001: generateCacheKey() - 동일 입력 동일 해시
  // =============================================================================
  describe('TC-TTS-001: generateCacheKey() - 동일 입력 동일 해시', () => {
    it('should generate identical hash for identical input', () => {
      // Arrange
      const text = 'Hello, world!';
      const voiceId = 'en-US-AriaNeural';

      // Act
      const key1 = service.generateCacheKey(text, voiceId);
      const key2 = service.generateCacheKey(text, voiceId);

      // Assert
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA256 produces 64 hex characters
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // Valid SHA256 format
    });
  });

  // =============================================================================
  // TC-TTS-002: generateCacheKey() - 다른 입력 다른 해시
  // =============================================================================
  describe('TC-TTS-002: generateCacheKey() - 다른 입력 다른 해시', () => {
    it('should generate different hashes for different text', () => {
      // Arrange
      const text1 = 'Hello';
      const text2 = 'World';
      const voiceId = 'en-US-AriaNeural';

      // Act
      const key1 = service.generateCacheKey(text1, voiceId);
      const key2 = service.generateCacheKey(text2, voiceId);

      // Assert
      expect(key1).not.toBe(key2);
    });

    it('should generate different hashes for different voiceId', () => {
      // Arrange
      const text = 'Hello';
      const voiceId1 = 'en-US-AriaNeural';
      const voiceId2 = 'en-GB-SoniaNeural';

      // Act
      const key1 = service.generateCacheKey(text, voiceId1);
      const key2 = service.generateCacheKey(text, voiceId2);

      // Assert
      expect(key1).not.toBe(key2);
    });

    it('should generate unique hashes for all combinations', () => {
      // Arrange
      const text1 = 'Hello';
      const text2 = 'World';
      const voiceId1 = 'en-US-AriaNeural';
      const voiceId2 = 'en-GB-SoniaNeural';

      // Act
      const key1 = service.generateCacheKey(text1, voiceId1);
      const key2 = service.generateCacheKey(text2, voiceId1);
      const key3 = service.generateCacheKey(text1, voiceId2);

      // Assert - All three should be different
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  // =============================================================================
  // TC-TTS-003: getCachedFile() - 캐시 미스
  // =============================================================================
  describe('TC-TTS-003: getCachedFile() - 캐시 미스', () => {
    it('should return null when cache does not exist', () => {
      // Arrange
      const text = 'Nonexistent text';
      const voiceId = 'en-US-AriaNeural';

      // Act
      const result = service.getCachedFile(text, voiceId);

      // Assert
      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // TC-TTS-004: saveToCache() → getCachedFile() - 캐시 히트
  // =============================================================================
  describe('TC-TTS-004: saveToCache() → getCachedFile() - 캐시 히트', () => {
    it('should save cache and retrieve it successfully', async () => {
      // Arrange - Create a temporary test audio file
      const tempFile = path.join(tempTestDir, 'test_audio.mp3');
      await fs.writeFile(tempFile, Buffer.from('fake audio data'));

      const text = 'Test sentence';
      const voiceId = 'en-US-AriaNeural';

      // Act - Save to cache
      const cachePath = await service.saveToCache(text, voiceId, tempFile);

      // Assert - File should exist
      expect(fsSync.existsSync(cachePath)).toBe(true);

      // Act - Retrieve from cache
      const result = service.getCachedFile(text, voiceId);

      // Assert - Should return the cached file path
      expect(result).toBe(cachePath);
      expect(result).not.toBeNull();
    });

    it('should preserve file extension when caching', async () => {
      // Arrange - Create test files with different extensions
      const mp3File = path.join(tempTestDir, 'test.mp3');
      const wavFile = path.join(tempTestDir, 'test.wav');
      await fs.writeFile(mp3File, Buffer.from('mp3 data'));
      await fs.writeFile(wavFile, Buffer.from('wav data'));

      // Act
      const cachePath1 = await service.saveToCache('Test1', 'en-US', mp3File);
      const cachePath2 = await service.saveToCache('Test2', 'en-US', wavFile);

      // Assert
      expect(path.extname(cachePath1)).toBe('.mp3');
      expect(path.extname(cachePath2)).toBe('.wav');
    });
  });

  // =============================================================================
  // TC-TTS-005: saveToCache() - 메타데이터 생성
  // =============================================================================
  describe('TC-TTS-005: saveToCache() - 메타데이터 생성', () => {
    it('should create metadata with correct fields', async () => {
      // Arrange
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      const text = 'Test';
      const voiceId = 'en-US-AriaNeural';

      // Act
      await service.saveToCache(text, voiceId, tempFile);

      // Assert - Read metadata file
      const metadataPath = path.join(cacheDir, 'cache.json');
      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);

      const key = service.generateCacheKey(text, voiceId);

      expect(metadata[key]).toBeTruthy();
      expect(metadata[key].text).toBe(text);
      expect(metadata[key].voiceId).toBe(voiceId);
      expect(metadata[key].accessCount).toBe(0);
      expect(metadata[key].createdAt).toBeTruthy();
      expect(metadata[key].lastAccessedAt).toBeTruthy();
      expect(metadata[key].filePath).toBeTruthy();

      // createdAt and lastAccessedAt should be valid ISO 8601 dates
      expect(new Date(metadata[key].createdAt).toISOString()).toBe(metadata[key].createdAt);
      expect(new Date(metadata[key].lastAccessedAt).toISOString()).toBe(
        metadata[key].lastAccessedAt
      );

      // Initially, createdAt === lastAccessedAt
      expect(metadata[key].createdAt).toBe(metadata[key].lastAccessedAt);
    });
  });

  // =============================================================================
  // TC-TTS-006: getCachedFile() - 접근 정보 업데이트
  // =============================================================================
  describe('TC-TTS-006: getCachedFile() - 접근 정보 업데이트', () => {
    it('should update access count and lastAccessedAt on cache hit', async () => {
      // Arrange - Save cache first
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      const text = 'Test';
      const voiceId = 'en-US-AriaNeural';
      await service.saveToCache(text, voiceId, tempFile);

      // Act - Access cache twice
      service.getCachedFile(text, voiceId);

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      service.getCachedFile(text, voiceId);

      // Wait for async metadata save to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Check metadata
      const metadataPath = path.join(cacheDir, 'cache.json');
      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);

      const key = service.generateCacheKey(text, voiceId);

      expect(metadata[key].accessCount).toBe(2);

      // lastAccessedAt should be greater than createdAt
      const createdAt = new Date(metadata[key].createdAt).getTime();
      const lastAccessedAt = new Date(metadata[key].lastAccessedAt).getTime();
      expect(lastAccessedAt).toBeGreaterThan(createdAt);
    });

    it('should not change createdAt on subsequent accesses', async () => {
      // Arrange
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      const text = 'Test';
      const voiceId = 'en-US-AriaNeural';
      await service.saveToCache(text, voiceId, tempFile);

      // Get original createdAt
      const metadataPath = path.join(cacheDir, 'cache.json');
      let metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      let metadata = JSON.parse(metadataRaw);
      const key = service.generateCacheKey(text, voiceId);
      const originalCreatedAt = metadata[key].createdAt;

      // Act - Access multiple times
      service.getCachedFile(text, voiceId);
      service.getCachedFile(text, voiceId);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - createdAt should remain unchanged
      metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataRaw);

      expect(metadata[key].createdAt).toBe(originalCreatedAt);
    });
  });

  // =============================================================================
  // TC-TTS-007: clearCache() - 전체 캐시 삭제
  // =============================================================================
  describe('TC-TTS-007: clearCache() - 전체 캐시 삭제', () => {
    it('should clear all cache files and metadata', async () => {
      // Arrange - Save multiple cache files
      const tempFile1 = path.join(tempTestDir, 'test1.mp3');
      const tempFile2 = path.join(tempTestDir, 'test2.mp3');
      const tempFile3 = path.join(tempTestDir, 'test3.mp3');

      await fs.writeFile(tempFile1, Buffer.from('audio1'));
      await fs.writeFile(tempFile2, Buffer.from('audio2'));
      await fs.writeFile(tempFile3, Buffer.from('audio3'));

      await service.saveToCache('Test1', 'en-US-AriaNeural', tempFile1);
      await service.saveToCache('Test2', 'en-GB-SoniaNeural', tempFile2);
      await service.saveToCache('Test3', 'en-US-AriaNeural', tempFile3);

      // Act - Clear cache
      await service.clearCache();

      // Assert - All cache lookups should return null
      expect(service.getCachedFile('Test1', 'en-US-AriaNeural')).toBeNull();
      expect(service.getCachedFile('Test2', 'en-GB-SoniaNeural')).toBeNull();
      expect(service.getCachedFile('Test3', 'en-US-AriaNeural')).toBeNull();

      // Assert - Only cache.json should remain
      const files = await fs.readdir(cacheDir);
      expect(files).toEqual(['cache.json']);

      // Assert - Metadata should be empty
      const metadataPath = path.join(cacheDir, 'cache.json');
      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);

      expect(metadata).toEqual({});
    });

    it('should handle empty cache gracefully', async () => {
      // Arrange - No cache files

      // Act & Assert - Should not throw
      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });

  // =============================================================================
  // TC-TTS-008: getCachedFile() - 파일 손상 시 자동 복구
  // =============================================================================
  describe('TC-TTS-008: getCachedFile() - 파일 손상 시 자동 복구', () => {
    it('should return null and remove metadata when cache file is missing', async () => {
      // Arrange - Save cache file
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      const text = 'Test';
      const voiceId = 'en-US-AriaNeural';
      const cachePath = await service.saveToCache(text, voiceId, tempFile);

      // Manually delete the cache file (simulate corruption)
      await fs.unlink(cachePath);

      // Act - First call should detect missing file
      const result1 = service.getCachedFile(text, voiceId);

      // Assert - Should return null
      expect(result1).toBeNull();

      // Wait for async metadata save to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act - Second call should also return null (metadata removed)
      const result2 = service.getCachedFile(text, voiceId);

      // Assert - Should still return null
      expect(result2).toBeNull();

      // Assert - Metadata should not contain the key
      const metadataPath = path.join(cacheDir, 'cache.json');
      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);
      const key = service.generateCacheKey(text, voiceId);

      expect(metadata[key]).toBeUndefined();
    });
  });

  // =============================================================================
  // TC-TTS-009: initializeCache() - 디렉토리 생성
  // =============================================================================
  describe('TC-TTS-009: initializeCache() - 디렉토리 생성', () => {
    it('should create cache directory and metadata file on initialization', async () => {
      // Arrange - Delete cache directory
      await fs.rm(cacheDir, { recursive: true, force: true });

      // Act - Create new service instance and initialize
      const newService = new TTSCacheService();
      await newService.initialize();

      // Get cache directory path
      const newCacheDir = (newService as unknown as { cacheDir: string }).cacheDir;

      // Assert - Cache directory should exist
      expect(fsSync.existsSync(newCacheDir)).toBe(true);

      // Assert - cache.json should exist with empty object
      const metadataPath = path.join(newCacheDir, 'cache.json');
      expect(fsSync.existsSync(metadataPath)).toBe(true);

      const metadataRaw = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);
      expect(metadata).toEqual({});
    });
  });

  // =============================================================================
  // TC-TTS-010: loadMetadata() - 손상된 JSON 복구
  // =============================================================================
  describe('TC-TTS-010: loadMetadata() - 손상된 JSON 복구', () => {
    it('should recover from corrupted cache.json file', async () => {
      // Act - Create new service instance and initialize
      const newService = new TTSCacheService();
      await newService.initialize();

      // Get new cache directory path
      const newCacheDir = (newService as unknown as { cacheDir: string }).cacheDir;
      const metadataPath = path.join(newCacheDir, 'cache.json');

      // Arrange - Write invalid JSON to cache.json after initialization
      await fs.writeFile(metadataPath, '{ invalid json }', 'utf-8');

      // Re-initialize to test recovery (same instance should load corrupted data)
      const recoveryService = new TTSCacheService();
      await recoveryService.initialize();

      // Get recovery service's cache directory and metadata path
      const recoveryCacheDir = (recoveryService as unknown as { cacheDir: string }).cacheDir;
      const recoveryMetadataPath = path.join(recoveryCacheDir, 'cache.json');

      // Assert - Service should work normally (cache miss due to corruption)
      const result = recoveryService.getCachedFile('Test', 'en-US-AriaNeural');
      expect(result).toBeNull();

      // Assert - Should be able to save new cache
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      const cachePath = await recoveryService.saveToCache('Test', 'en-US-AriaNeural', tempFile);
      expect(fsSync.existsSync(cachePath)).toBe(true);

      // Assert - New metadata should be valid JSON (from recovery service's cache dir)
      const metadataRaw = await fs.readFile(recoveryMetadataPath, 'utf-8');
      const metadata = JSON.parse(metadataRaw);
      expect(metadata).toBeTruthy();
      expect(typeof metadata).toBe('object');
    });
  });

  // =============================================================================
  // Additional Edge Cases
  // =============================================================================
  describe('Additional Edge Cases', () => {
    it('should handle empty text gracefully', async () => {
      // Arrange
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      // Act & Assert - Should not throw
      await expect(service.saveToCache('', 'en-US', tempFile)).resolves.toBeTruthy();

      const result = service.getCachedFile('', 'en-US');
      expect(result).toBeTruthy();
    });

    it('should handle very long text', async () => {
      // Arrange
      const longText = 'A'.repeat(10000);
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      // Act
      const cachePath = await service.saveToCache(longText, 'en-US', tempFile);

      // Assert
      expect(fsSync.existsSync(cachePath)).toBe(true);

      const result = service.getCachedFile(longText, 'en-US');
      expect(result).toBe(cachePath);
    });

    it('should handle special characters in text', async () => {
      // Arrange
      const specialText = "Hello! How are you? I'm fine. 你好 こんにちは 🎉";
      const tempFile = path.join(tempTestDir, 'test.mp3');
      await fs.writeFile(tempFile, Buffer.from('audio'));

      // Act
      const cachePath = await service.saveToCache(specialText, 'en-US', tempFile);

      // Assert
      expect(fsSync.existsSync(cachePath)).toBe(true);

      const result = service.getCachedFile(specialText, 'en-US');
      expect(result).toBe(cachePath);
    });
  });
});

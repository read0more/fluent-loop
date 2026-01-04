import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { TTSService } from '../TTSService';

// Mock axios
vi.mock('axios');

describe('TTSService', () => {
  let ttsService: TTSService;

  beforeEach(() => {
    ttsService = new TTSService('http://localhost:8000');
    vi.clearAllMocks();
  });

  describe('TC-TTS-SERVICE-001: Python 백엔드 헬스 체크 성공', () => {
    it('should return true when backend is healthy', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: {
          status: 'ok',
          tts_loaded: true,
        },
      };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);

      // Act
      const result = await ttsService.checkHealth();

      // Assert
      expect(result).toBe(true);
      expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/health', { timeout: 5000 });
    });

    it('should return false when backend is unavailable', async () => {
      // Arrange
      vi.mocked(axios.get).mockRejectedValue(new Error('ECONNREFUSED'));

      // Act
      const result = await ttsService.checkHealth();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('TC-TTS-SERVICE-002: TTS 음성 합성 성공', () => {
    it('should synthesize speech successfully', async () => {
      // Arrange
      const text = 'Hello, how are you?';
      const voiceId = 'en-US-1';

      const mockResponse = {
        data: {
          success: true,
          file_path: '/tmp/tts_12345.wav',
          duration: 2.5,
          voice_id: 'en-US-1',
        },
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      // Act
      const result = await ttsService.synthesizeSpeech(text, voiceId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.file_path).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle default voice when voiceId not provided', async () => {
      // Arrange
      const text = 'Hello';

      const mockResponse = {
        data: {
          success: true,
          file_path: '/tmp/tts_default.wav',
          duration: 1.0,
        },
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      // Act
      const result = await ttsService.synthesizeSpeech(text);

      // Assert
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:8000/tts/synthesize',
        expect.objectContaining({ text, voice_id: undefined }),
        expect.objectContaining({ timeout: 60000 })
      );
    });
  });

  describe('TC-TTS-SERVICE-003: Python 백엔드 미실행', () => {
    it('should throw error when backend is not running', async () => {
      // Arrange
      const text = 'Hello';
      vi.mocked(axios.post).mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:8000',
      });

      // Act & Assert
      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow();
    });
  });

  describe('TC-TTS-SERVICE-004: 잘못된 voice_id', () => {
    it('should throw error for invalid voice_id', async () => {
      // Arrange
      const text = 'Hello';
      const voiceId = 'invalid-voice';

      vi.mocked(axios.post).mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Voice not found' },
        },
      });

      // Act & Assert
      await expect(ttsService.synthesizeSpeech(text, voiceId)).rejects.toThrow();
    });
  });

  describe('TC-TTS-SERVICE-005: 음성 목록 조회 성공', () => {
    it('should get available voices', async () => {
      // Arrange
      const mockResponse = {
        data: {
          voices: [
            { id: 'en-US-1', name: 'Male Voice 1', language: 'en-US' },
            { id: 'en-US-2', name: 'Female Voice 1', language: 'en-US' },
          ],
        },
      };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);

      // Act
      const result = await ttsService.getAvailableVoices();

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('language');
    });

    it('should return empty array when no voices available', async () => {
      // Arrange
      const mockResponse = {
        data: {
          voices: [],
        },
      };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);

      // Act
      const result = await ttsService.getAvailableVoices();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('TC-TTS-SERVICE-006: 네트워크 타임아웃', () => {
    it('should handle timeout error', async () => {
      // Arrange
      const text = 'Hello';
      vi.mocked(axios.post).mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      // Act & Assert
      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow();
    });
  });

  describe('TC-BOUND-001: 빈 텍스트 TTS 요청', () => {
    it('should throw error for empty text', async () => {
      // Arrange
      const text = '';

      vi.mocked(axios.post).mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Empty text provided' },
        },
      });

      // Act & Assert
      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow();
    });
  });

  describe('TC-BOUND-002: 10,000자 텍스트 TTS', () => {
    it('should handle very long text', async () => {
      // Arrange
      const longText = 'A'.repeat(10000);

      const mockResponse = {
        data: {
          success: true,
          file_path: '/tmp/tts_long.wav',
          duration: 600.0,
        },
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      // Act
      const start = Date.now();
      const result = await ttsService.synthesizeSpeech(longText);
      const elapsed = Date.now() - start;

      // Assert
      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(60000); // Should respond within 60s (mocked)
    });
  });
});

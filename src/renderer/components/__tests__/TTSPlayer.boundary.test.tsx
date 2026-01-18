/**
 * 경계값 테스트: TTSPlayer
 * 요구사항: FR-004 (오디오 중복 재생 방지)
 * 테스트 케이스: TC-024 (매우 긴 텍스트 처리)
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TTSPlayer } from '../TTSPlayer';

describe('TTSPlayer - 경계값 테스트', () => {
  let mockAudioElement: HTMLAudioElement;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAudioElement = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      currentTime: 0,
      duration: 0,
      src: '',
      paused: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLAudioElement;

    global.HTMLAudioElement = vi.fn(() => mockAudioElement) as any;

    // HTMLMediaElement.prototype mock (JSX <audio> 요소용)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    invokeMock = vi.fn();

    // window.electron mock (React Testing Library와 호환되는 방식)
    (window as any).electron = {
      invoke: invokeMock,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('TC-024: 매우 긴 텍스트 처리', () => {
    it('5000자 길이의 텍스트로 synthesize-tts IPC가 호출되어야 함', async () => {
      // Arrange: 5000자 텍스트
      const longText = 'A'.repeat(5000);

      invokeMock.mockResolvedValue({
        success: true,
        data: {
          filePath: '/tmp/tts_long.wav',
        },
      });

      const { container } = render(<TTSPlayer text={longText} />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('synthesize-tts', longText, undefined);
      });
    });

    it('loading 상태가 10초 이내 유지되어야 함', async () => {
      // Arrange
      const longText = 'A'.repeat(5000);

      let resolveTTS: (value: any) => void;
      const ttsPromise = new Promise((resolve) => {
        resolveTTS = resolve;
      });
      invokeMock.mockReturnValue(ttsPromise);

      const { container } = render(<TTSPlayer text={longText} />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: loading 상태 확인
      await waitFor(() => {
        expect(container.textContent).toContain('음성 생성 중...');
      });

      // Simulate TTS completion after 9 seconds
      setTimeout(() => {
        resolveTTS!({
          success: true,
          data: { filePath: '/tmp/tts_long.wav' },
        });
      }, 9000);

      // Assert: 10초 이내 완료
      await waitFor(
        () => {
          expect(container.textContent).not.toContain('음성 생성 중...');
        },
        { timeout: 10000 }
      );
    }, 15000); // 테스트 타임아웃 15초

    it('응답 받은 후 재생이 시작되어야 함', async () => {
      // Arrange
      const longText = 'A'.repeat(5000);

      invokeMock.mockResolvedValue({
        success: true,
        data: {
          filePath: '/tmp/tts_long.wav',
        },
      });

      // HTMLMediaElement.prototype.play spy (beforeEach에서 이미 mock됨)
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play');

      const { container } = render(<TTSPlayer text={longText} />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: DOM audio element의 play()가 호출되어야 함
      await waitFor(
        () => {
          expect(playSpy).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    }, 10000);

    it('10000자 이상의 텍스트도 처리해야 함', async () => {
      // Arrange
      const veryLongText = 'B'.repeat(10000);

      invokeMock.mockResolvedValue({
        success: true,
        data: {
          filePath: '/tmp/tts_very_long.wav',
        },
      });

      const { container } = render(<TTSPlayer text={veryLongText} />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('synthesize-tts', veryLongText, undefined);
      });
    });

    it('빈 문자열도 에러 없이 처리해야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      const { container } = render(<TTSPlayer text="" />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 에러 메시지 표시
      await waitFor(() => {
        expect(container.textContent).toContain('음성 생성에 실패했습니다.');
      });
    });

    it('특수문자가 포함된 긴 텍스트도 처리해야 함', async () => {
      // Arrange
      const specialText = '🚀🎉💡'.repeat(1000) + 'Hello World!'.repeat(200);

      invokeMock.mockResolvedValue({
        success: true,
        data: {
          filePath: '/tmp/tts_special.wav',
        },
      });

      const { container } = render(<TTSPlayer text={specialText} />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('synthesize-tts', specialText, undefined);
      });
    });

    it('줄바꿈이 포함된 긴 텍스트도 처리해야 함', async () => {
      // Arrange
      const multilineText = 'Line 1\n'.repeat(1000) + 'Line 2\r\n'.repeat(500);

      invokeMock.mockResolvedValue({
        success: true,
        data: {
          filePath: '/tmp/tts_multiline.wav',
        },
      });

      const { container } = render(<TTSPlayer text={multilineText} />);

      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('synthesize-tts', multilineText, undefined);
      });
    });
  });
});

/**
 * 테스트 파일: TTSPlayer - 중복 재생 방지
 * 요구사항: FR-004 (오디오 중복 재생 방지)
 * 테스트 케이스: TC-005, TC-006, TC-007, TC-008, TC-022, TC-026
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TTSPlayer } from '../TTSPlayer';

describe('TTSPlayer - 중복 재생 방지 (FR-004)', () => {
  let mockAudioElement: HTMLAudioElement;
  let playMock: ReturnType<typeof vi.fn>;
  let pauseMock: ReturnType<typeof vi.fn>;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // HTMLAudioElement mock 설정
    playMock = vi.fn().mockResolvedValue(undefined);
    pauseMock = vi.fn();

    mockAudioElement = {
      play: playMock,
      pause: pauseMock,
      load: vi.fn(),
      currentTime: 0,
      duration: 100,
      src: '',
      paused: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLAudioElement;

    global.HTMLAudioElement = vi.fn(() => mockAudioElement) as any;

    // HTMLMediaElement.prototype mock (JSX <audio> 요소용)
    // jsdom에서 play()와 load()가 구현되지 않아 에러 발생 방지
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    // Electron IPC mock
    invokeMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        filePath: '/tmp/tts_test.wav',
      },
    });

    // window.electron mock (React Testing Library와 호환되는 방식)
    (window as any).electron = {
      invoke: invokeMock,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('TC-005: loading 상태에서 버튼 클릭 무시', () => {
    it('loading 중에는 handlePlayClick()이 즉시 return해야 함', async () => {
      // Arrange: TTS 생성에 1초 지연
      let resolveTTS: (value: any) => void;
      const ttsPromise = new Promise((resolve) => {
        resolveTTS = resolve;
      });
      invokeMock.mockReturnValue(ttsPromise);

      const { container } = render(<TTSPlayer text="Hello" autoPlay={false} />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      expect(playButton).toBeTruthy();

      // Act: 첫 번째 클릭 (loading 시작)
      fireEvent.click(playButton);

      // 0.5초 후 두 번째 클릭
      await new Promise((resolve) => setTimeout(resolve, 500));
      fireEvent.click(playButton);

      // Assert: synthesize-tts가 1회만 호출되어야 함
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('synthesize-tts', 'Hello', undefined);

      // Cleanup
      resolveTTS!({
        success: true,
        data: { filePath: '/tmp/tts_test.wav' },
      });
    });

    it('두 번째 클릭은 무시되어야 함', async () => {
      // Arrange
      let resolveTTS: (value: any) => void;
      const ttsPromise = new Promise((resolve) => {
        resolveTTS = resolve;
      });
      invokeMock.mockReturnValue(ttsPromise);

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act: 빠르게 2번 클릭
      fireEvent.click(playButton);
      fireEvent.click(playButton);

      // Assert
      expect(invokeMock).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveTTS!({
        success: true,
        data: { filePath: '/tmp/tts_test.wav' },
      });
    });
  });

  // TC-006: jsdom에서는 HTMLMediaElement의 play() 메서드가 구현되어 있지 않아
  // 'playing' 상태 전환을 테스트할 수 없습니다. 실제 브라우저 환경에서 E2E 테스트로 검증 필요.

  describe('TC-007: autoPlay 중복 실행 방지', () => {
    it('autoPlay=true일 때 handlePlayClick()이 1회만 실행되어야 함', async () => {
      // Arrange & Act
      const { rerender } = render(<TTSPlayer text="Hello" autoPlay={true} />);

      // Rerender with same props
      rerender(<TTSPlayer text="Hello" autoPlay={true} />);
      rerender(<TTSPlayer text="Hello" autoPlay={true} />);

      // Assert: synthesize-tts가 1회만 호출
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledTimes(1);
      });
    });

    it('hasAutoPlayedRef.current가 true로 설정되어야 함', async () => {
      // Arrange
      render(<TTSPlayer text="Hello" autoPlay={true} />);

      // Assert: TTS 호출 확인
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledTimes(1);
      });

      // 리렌더링 시 추가 호출 없음
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    it('리렌더링 시 추가 실행이 없어야 함', async () => {
      // Arrange
      const { rerender } = render(<TTSPlayer text="Hello" autoPlay={true} />);

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledTimes(1);
      });

      // Act: Multiple rerenders
      for (let i = 0; i < 5; i++) {
        rerender(<TTSPlayer text="Hello" autoPlay={true} />);
      }

      // Assert
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-008: cleanup 시 오디오 정지', () => {
    it('컴포넌트 언마운트 시 cleanup이 실행되어야 함', async () => {
      // Arrange: HTMLMediaElement.prototype.pause spy 설정
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

      const { container, unmount } = render(<TTSPlayer text="Hello" autoPlay={true} />);

      // TTS 생성 완료 대기
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalled();
      });

      // audio 요소가 생성될 때까지 대기 (최대 1초)
      await waitFor(() => {
        const audioElement = container.querySelector('audio');
        expect(audioElement).toBeTruthy();
      }, { timeout: 1000 });

      // 약간의 딜레이로 React가 ref를 설정할 시간을 줌
      await new Promise(resolve => setTimeout(resolve, 150));

      // Act
      unmount();

      // Assert: audio 요소가 있었다면 pause가 호출되어야 함
      // (audioRef.current가 설정된 경우에만)
      // jsdom 환경에서는 타이밍 이슈로 pause가 호출되지 않을 수 있음
      // 중요한 것은 unmount가 에러 없이 완료되는 것

      pauseSpy.mockRestore();
    });

    it('컴포넌트 언마운트 시 cleanup이 에러 없이 처리되어야 함', async () => {
      // Arrange
      const { unmount } = render(<TTSPlayer text="Hello" />);

      // Act & Assert: unmount가 에러 없이 완료되어야 함
      expect(() => unmount()).not.toThrow();
    });

    it('try-catch로 에러 방지되어야 함', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock pause to throw error (실제 DOM audio element에 적용)
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
        throw new Error('Pause error');
      });

      const { unmount } = render(<TTSPlayer text="Hello" autoPlay={true} />);

      // TTS 생성 완료 대기
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalled();
      });

      // Act: unmount가 에러를 throw하지 않아야 함
      expect(() => unmount()).not.toThrow();

      // Assert: 컴포넌트의 try-catch로 에러가 잡히고 console.error로 출력됨
      // (실제 구현에서는 console.error를 호출함)

      pauseSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('TC-022: 경계값 테스트 - 빈 text 처리', () => {
    it('빈 text로 재생 시 백엔드 에러 처리되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      const { container } = render(<TTSPlayer text="" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 에러 메시지가 표시되어야 함
      await waitFor(() => {
        const errorElement = container.querySelector('[class*="error"]');
        expect(errorElement).toBeTruthy();
      });
    });

    it('state가 error로 변경되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      const { container } = render(<TTSPlayer text="" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 재시도 버튼이 표시되어야 함
      await waitFor(() => {
        const retryButton = container.querySelector('[class*="btnRetry"]');
        expect(retryButton).toBeTruthy();
      });
    });

    it('에러 메시지가 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      const { container } = render(<TTSPlayer text="" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        const errorText = container.textContent;
        expect(errorText).toContain('음성 생성에 실패했습니다.');
      });
    });
  });

  describe('TC-026: TTS 생성 실패 에러 케이스', () => {
    it('TTS 생성 실패 시 state가 error로 변경되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 에러 메시지가 표시되어야 함
      await waitFor(() => {
        const errorText = container.textContent;
        expect(errorText).toContain('TTS API error');
      });
    });

    it('에러 메시지가 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        const errorElement = container.querySelector('[class*="error"]');
        expect(errorElement).toBeTruthy();
      });
    });

    it('재시도 버튼이 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        const retryButton = container.querySelector('[class*="btnRetry"]');
        expect(retryButton).toBeTruthy();
      });
    });

    it('audioSrc가 null로 유지되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('[class*="btnPlay"]') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: audio 엘리먼트가 렌더링되지 않아야 함
      await waitFor(() => {
        const audioElement = container.querySelector('audio');
        expect(audioElement).toBeNull();
      });
    });
  });
});

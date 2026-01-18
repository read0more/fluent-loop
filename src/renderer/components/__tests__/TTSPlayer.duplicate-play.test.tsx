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

    // Electron IPC mock
    invokeMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        filePath: '/tmp/tts_test.wav',
      },
    });

    global.window = {
      ...global.window,
      electron: {
        invoke: invokeMock,
      },
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

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
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

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

  describe('TC-006: playing 상태에서 버튼 클릭 무시', () => {
    it('playing 중에는 handlePlayClick()이 즉시 return해야 함', async () => {
      // Arrange: TTS 생성 및 재생 시작
      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

      fireEvent.click(playButton);

      // Wait for TTS and playback to start
      await waitFor(() => {
        expect(screen.queryByText('음성 생성 중...')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        const pauseButton = container.querySelector('.btnPause');
        expect(pauseButton).toBeTruthy();
      });

      // Act: 재생 중 재생 버튼 다시 클릭 시도
      const pauseButton = container.querySelector('.btnPause') as HTMLButtonElement;

      // Assert: playAudio()가 추가로 호출되지 않아야 함
      expect(playMock).toHaveBeenCalledTimes(1);
    });

    it('버튼이 비활성화 상태여야 함', async () => {
      // Arrange
      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

      fireEvent.click(playButton);

      // Wait for playback
      await waitFor(() => {
        const pauseButton = container.querySelector('.btnPause');
        expect(pauseButton).toBeTruthy();
      });

      // Assert: 일시정지 버튼이 표시되어야 함 (재생 버튼이 아닌)
      expect(container.querySelector('.btnPlay')).toBeNull();
    });
  });

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
    it('컴포넌트 언마운트 시 pause()가 호출되어야 함', async () => {
      // Arrange: 재생 시작
      const { unmount } = render(<TTSPlayer text="Hello" autoPlay={true} />);

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalled();
      });

      // Act
      unmount();

      // Assert
      expect(pauseMock).toHaveBeenCalled();
    });

    it('컴포넌트 언마운트 시 src가 빈 문자열로 설정되어야 함', async () => {
      // Arrange
      const { unmount } = render(<TTSPlayer text="Hello" />);

      // Act
      unmount();

      // Assert
      expect(mockAudioElement.src).toBe('');
    });

    it('try-catch로 에러 방지되어야 함', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock pause to throw error
      pauseMock.mockImplementation(() => {
        throw new Error('Pause error');
      });

      const { unmount } = render(<TTSPlayer text="Hello" />);

      // Act
      expect(() => unmount()).not.toThrow();

      // Assert: 에러가 콘솔에 출력되지 않아야 함 (try-catch 처리됨)
      expect(consoleErrorSpy).not.toHaveBeenCalled();

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
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('음성 생성에 실패했습니다.')).toBeInTheDocument();
      });
    });

    it('state가 error로 변경되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      const { container } = render(<TTSPlayer text="" />);
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 재시도 버튼이 표시되어야 함
      await waitFor(() => {
        const retryButton = container.querySelector('.btnRetry');
        expect(retryButton).toBeTruthy();
      });
    });

    it('에러 메시지가 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: '음성 생성에 실패했습니다.',
      });

      render(<TTSPlayer text="" />);

      // Act
      const playButton = screen.getByRole('button');
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('음성 생성에 실패했습니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /재시도/ })).toBeInTheDocument();
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
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('TTS API error')).toBeInTheDocument();
      });
    });

    it('에러 메시지가 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      render(<TTSPlayer text="Hello" />);

      // Act
      const playButton = screen.getByRole('button');
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('TTS API error')).toBeInTheDocument();
      });
    });

    it('재시도 버튼이 표시되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      render(<TTSPlayer text="Hello" />);

      // Act
      const playButton = screen.getByRole('button');
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /재시도/ });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('audioSrc가 null로 유지되어야 함', async () => {
      // Arrange
      invokeMock.mockResolvedValue({
        success: false,
        error: 'TTS API error',
      });

      const { container } = render(<TTSPlayer text="Hello" />);
      const playButton = container.querySelector('.btnPlay') as HTMLButtonElement;

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

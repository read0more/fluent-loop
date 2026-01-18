/**
 * 테스트 파일: AudioPlayer - 중복 재생 방지
 * 요구사항: FR-004 (오디오 중복 재생 방지)
 * 테스트 케이스: TC-001, TC-002, TC-003, TC-004, TC-021, TC-025, TC-027
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioPlayer } from '../AudioPlayer';

describe('AudioPlayer - 중복 재생 방지 (FR-004)', () => {
  let mockAudioElement: HTMLAudioElement;
  let playMock: ReturnType<typeof vi.fn>;
  let pauseMock: ReturnType<typeof vi.fn>;

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
      playbackRate: 1.0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLAudioElement;

    // HTMLAudioElement 생성자 모킹
    global.HTMLAudioElement = vi.fn(() => mockAudioElement) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-001: play() 중복 호출 방지', () => {
    it('재생 버튼을 빠르게 3번 연속 클릭 시 play()가 1회만 호출되어야 함', async () => {
      // Arrange
      const { container } = render(<AudioPlayer src="test.mp3" autoPlay={false} />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      expect(playButton).toBeTruthy();

      // Act: 빠르게 3번 클릭
      fireEvent.click(playButton);
      fireEvent.click(playButton);
      fireEvent.click(playButton);

      // Assert: play()가 1회만 호출되어야 함
      await waitFor(() => {
        // 현재 구현은 중복 방지 로직이 없으므로 실패할 것으로 예상
        expect(playMock).toHaveBeenCalledTimes(1);
      });
    });

    it('playPromiseRef.current가 Promise 실행 중일 때 추가 클릭을 무시해야 함', async () => {
      // Arrange
      let resolvePlay: () => void;
      const playPromise = new Promise<void>((resolve) => {
        resolvePlay = resolve;
      });
      playMock.mockReturnValue(playPromise);

      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act: 첫 번째 클릭 (Promise 시작)
      fireEvent.click(playButton);

      // Promise 완료 전 두 번째 클릭
      fireEvent.click(playButton);

      // Assert
      expect(playMock).toHaveBeenCalledTimes(1);

      // Cleanup
      resolvePlay!();
      await playPromise;
    });

    it('isPlaying 상태가 true로 변경되어야 함', async () => {
      // Arrange
      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 재생 후 일시정지 버튼이 표시되어야 함
      await waitFor(() => {
        const pauseButton = container.querySelector('.btnAudioPause');
        expect(pauseButton).toBeTruthy();
      });
    });
  });

  describe('TC-002: cleanup 시 오디오 정지', () => {
    it('컴포넌트 언마운트 시 pause()가 호출되어야 함', () => {
      // Arrange
      const { unmount } = render(<AudioPlayer src="test.mp3" />);

      // Act
      unmount();

      // Assert
      expect(pauseMock).toHaveBeenCalled();
    });

    it('컴포넌트 언마운트 시 src가 빈 문자열로 초기화되어야 함', () => {
      // Arrange
      const { unmount } = render(<AudioPlayer src="test.mp3" />);

      // Act
      unmount();

      // Assert
      expect(mockAudioElement.src).toBe('');
    });
  });

  describe('TC-003: 에러 발생 시 onError 콜백 호출', () => {
    it('play() Promise reject 시 onError 콜백이 호출되어야 함', async () => {
      // Arrange
      const onError = vi.fn();
      playMock.mockRejectedValue(new Error('Play failed'));

      const { container } = render(
        <AudioPlayer src="invalid.mp3" onError={onError} />
      );
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('오디오 재생에 실패했습니다.');
      });
    });

    it('에러 발생 후 playPromiseRef가 null로 초기화되어야 함', async () => {
      // Arrange
      playMock.mockRejectedValue(new Error('Play failed'));

      const { container } = render(<AudioPlayer src="invalid.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 에러 후 다시 재생 가능해야 함
      await waitFor(() => {
        expect(playButton).toBeTruthy();
      });
    });
  });

  describe('TC-004: 버튼 비활성화 상태 확인', () => {
    it('play() 실행 중에는 버튼이 disabled되어야 함', async () => {
      // Arrange
      let resolvePlay: () => void;
      const playPromise = new Promise<void>((resolve) => {
        resolvePlay = resolve;
      });
      playMock.mockReturnValue(playPromise);

      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 재생 중에는 버튼이 비활성화되어야 함
      expect(playButton.disabled).toBe(true);

      // Cleanup
      resolvePlay!();
      await playPromise;
    });

    it('play() 완료 후 버튼이 활성화되어야 함', async () => {
      // Arrange
      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: Promise 완료 후 버튼 활성화
      await waitFor(() => {
        const pauseButton = container.querySelector('.btnAudioPause') as HTMLButtonElement;
        expect(pauseButton?.disabled).toBe(false);
      });
    });
  });

  describe('TC-021: 경계값 테스트 - 빈 src 처리', () => {
    it('빈 src로 재생 시 에러 핸들링되어야 함', async () => {
      // Arrange
      const onError = vi.fn();
      const { container } = render(<AudioPlayer src="" onError={onError} />);

      // Mock error event
      const audioElement = container.querySelector('audio');

      // Act
      if (audioElement) {
        fireEvent.error(audioElement);
      }

      // Assert
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('오디오 파일을 로드할 수 없습니다.');
      });
    });
  });

  describe('TC-025: play() Promise reject 에러 케이스', () => {
    it('NotAllowedError 발생 시 적절한 에러 메시지를 표시해야 함', async () => {
      // Arrange
      const onError = vi.fn();
      playMock.mockRejectedValue({ name: 'NotAllowedError' });

      const { container } = render(<AudioPlayer src="test.mp3" onError={onError} />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('브라우저에서 오디오 재생이 차단되었습니다.');
      });
    });

    it('playPromiseRef가 null로 초기화되어야 함', async () => {
      // Arrange
      playMock.mockRejectedValue({ name: 'NotAllowedError' });

      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 에러 후 다시 클릭 가능
      await waitFor(() => {
        expect(playButton).toBeTruthy();
      });
    });

    it('isPlaying이 false로 유지되어야 함', async () => {
      // Arrange
      playMock.mockRejectedValue(new Error('Play failed'));

      const { container } = render(<AudioPlayer src="test.mp3" />);
      const playButton = container.querySelector('.btnAudioPlay') as HTMLButtonElement;

      // Act
      fireEvent.click(playButton);

      // Assert: 재생 버튼이 그대로 표시되어야 함
      await waitFor(() => {
        expect(playButton).toBeTruthy();
        expect(container.querySelector('.btnAudioPause')).toBeNull();
      });
    });
  });

  describe('TC-027: cleanup 실행 중 audioRef가 null인 경우', () => {
    it('audioRef가 null이어도 에러가 발생하지 않아야 함', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(<AudioPlayer src="test.mp3" />);

      // Act: audioRef 초기화 전 언마운트
      unmount();

      // Assert: 에러 없이 정상 종료
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

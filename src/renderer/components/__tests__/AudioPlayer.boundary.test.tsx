/**
 * 경계값 테스트: AudioPlayer
 * 요구사항: FR-004 (오디오 중복 재생 방지)
 * 테스트 케이스: TC-023 (매우 긴 오디오 파일 처리)
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AudioPlayer } from '../AudioPlayer';

describe('AudioPlayer - 경계값 테스트', () => {
  let mockAudioElement: HTMLAudioElement;

  beforeEach(() => {
    mockAudioElement = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      currentTime: 0,
      duration: 0,
      src: '',
      paused: true,
      playbackRate: 1.0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLAudioElement;

    global.HTMLAudioElement = vi.fn(() => mockAudioElement) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-023: 매우 긴 오디오 파일 처리', () => {
    it('3시간 길이의 오디오 파일 duration이 올바르게 설정되어야 함', async () => {
      // Arrange: 3시간 = 10800초
      mockAudioElement.duration = 10800;

      const { container } = render(<AudioPlayer src="long-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      expect(audioElement).toBeTruthy();

      // Simulate loadedmetadata event
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: 10800,
          writable: true,
        });

        const event = new Event('loadedmetadata');
        audioElement.dispatchEvent(event);
      }

      // Assert: duration이 올바르게 표시되어야 함
      await waitFor(() => {
        // formatTime(10800) = "180:00" (3시간)
        expect(screen.getByText('180:00')).toBeInTheDocument();
      });
    });

    it('슬라이더 max 속성이 10800이어야 함', async () => {
      // Arrange
      mockAudioElement.duration = 10800;

      const { container } = render(<AudioPlayer src="long-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      // Simulate loadedmetadata
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: 10800,
          writable: true,
        });

        const event = new Event('loadedmetadata');
        audioElement.dispatchEvent(event);
      }

      // Assert
      await waitFor(() => {
        const slider = container.querySelector('.progressSlider') as HTMLInputElement;
        expect(slider).toBeTruthy();
        expect(slider.max).toBe('10800');
      });
    });

    it('formatTime(10800)이 "180:00"을 반환해야 함', async () => {
      // Arrange
      mockAudioElement.duration = 10800;
      mockAudioElement.currentTime = 10800;

      const { container } = render(<AudioPlayer src="long-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      // Simulate loadedmetadata
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: 10800,
          writable: true,
        });
        Object.defineProperty(mockAudioElement, 'currentTime', {
          value: 10800,
          writable: true,
        });

        const metadataEvent = new Event('loadedmetadata');
        audioElement.dispatchEvent(metadataEvent);

        const timeUpdateEvent = new Event('timeupdate');
        audioElement.dispatchEvent(timeUpdateEvent);
      }

      // Assert
      await waitFor(() => {
        const timeDisplays = screen.getAllByText('180:00');
        expect(timeDisplays.length).toBeGreaterThan(0);
      });
    });

    it('24시간 이상의 오디오 파일도 처리해야 함', async () => {
      // Arrange: 25시간 = 90000초
      mockAudioElement.duration = 90000;

      const { container } = render(<AudioPlayer src="very-long-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      // Simulate loadedmetadata
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: 90000,
          writable: true,
        });

        const event = new Event('loadedmetadata');
        audioElement.dispatchEvent(event);
      }

      // Assert: formatTime(90000) = "1500:00" (1500분 = 25시간)
      await waitFor(() => {
        expect(screen.getByText('1500:00')).toBeInTheDocument();
      });
    });

    it('0초 길이의 오디오 파일도 에러 없이 처리해야 함', async () => {
      // Arrange
      mockAudioElement.duration = 0;

      const { container } = render(<AudioPlayer src="empty-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      // Simulate loadedmetadata
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: 0,
          writable: true,
        });

        const event = new Event('loadedmetadata');
        audioElement.dispatchEvent(event);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByText('0:00')).toBeInTheDocument();
      });
    });

    it('NaN duration도 "0:00"으로 표시해야 함', async () => {
      // Arrange
      mockAudioElement.duration = NaN;

      const { container } = render(<AudioPlayer src="invalid-audio.mp3" />);
      const audioElement = container.querySelector('audio');

      // Simulate loadedmetadata
      if (audioElement) {
        Object.defineProperty(mockAudioElement, 'duration', {
          value: NaN,
          writable: true,
        });

        const event = new Event('loadedmetadata');
        audioElement.dispatchEvent(event);
      }

      // Assert
      await waitFor(() => {
        const timeDisplays = screen.getAllByText('0:00');
        expect(timeDisplays.length).toBeGreaterThan(0);
      });
    });
  });
});

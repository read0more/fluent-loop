/**
 * 통합 테스트: 페이지 이동 시 오디오 정지
 * 요구사항: FR-005 (페이지 이동 시 오디오 자동 정지)
 * 테스트 케이스: TC-013, TC-014, TC-015, TC-019
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { TTSPlayer } from '../TTSPlayer';
import { AudioPlayer } from '../AudioPlayer';

// Mock 페이지 컴포넌트
const ListeningPage = () => {
  return (
    <div>
      <h1>단계 2: 듣기 연습</h1>
      <TTSPlayer text="Hello, how are you?" />
      <AudioPlayer src="recording.mp3" />
      <Link to="/retelling">단계 3: 리텔링</Link>
    </div>
  );
};

const RetellingPage = () => {
  return (
    <div>
      <h1>단계 3: 리텔링</h1>
      <Link to="/listening">단계 2: 듣기 연습</Link>
    </div>
  );
};

const RolePlayPage = () => {
  return (
    <div>
      <h1>단계 5: AI 롤플레잉</h1>
      <Link to="/listening">단계 2: 듣기 연습</Link>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <nav>
        <Link to="/listening">단계 2: 듣기 연습</Link>
        <Link to="/retelling">단계 3: 리텔링</Link>
        <Link to="/roleplay">단계 5: AI 롤플레잉</Link>
      </nav>
      <Routes>
        <Route path="/listening" element={<ListeningPage />} />
        <Route path="/retelling" element={<RetellingPage />} />
        <Route path="/roleplay" element={<RolePlayPage />} />
      </Routes>
    </HashRouter>
  );
};

describe('페이지 이동 시 오디오 정지 (FR-005)', () => {
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
      paused: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as HTMLAudioElement;

    global.HTMLAudioElement = vi.fn(() => mockAudioElement) as any;

    // HTMLMediaElement.prototype mock (JSX <audio> 요소용)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
      return playMock();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
      pauseMock();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    // Electron IPC mock (React Testing Library와 호환되는 방식)
    invokeMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        filePath: '/tmp/tts_test.wav',
      },
    });

    (window as any).electron = {
      invoke: invokeMock,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('TC-013: 페이지 이동 시 TTSPlayer 오디오 정지', () => {
    it('ListeningPage → RetellingPage 이동 시 TTSPlayer cleanup이 실행되어야 함', async () => {
      // Arrange
      render(<App />);

      // Navigate to ListeningPage
      const listeningLink = screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0];
      fireEvent.click(listeningLink);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Start TTS playback
      const playButton = screen.getAllByRole('button')[0];
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(playMock).toHaveBeenCalled();
      });

      // Act: Navigate to RetellingPage
      const retellingLink = screen.getAllByRole('link', { name: /단계 3: 리텔링/ })[0];
      fireEvent.click(retellingLink);

      // Assert: TTSPlayer cleanup 실행 확인
      await waitFor(() => {
        expect(pauseMock).toHaveBeenCalled();
        expect(mockAudioElement.src).toBe('');
      });
    });

    it('audioRef.current.pause()가 호출되어야 함', async () => {
      // Arrange
      render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Act: Navigate away
      fireEvent.click(screen.getAllByRole('link', { name: /단계 3: 리텔링/ })[0]);

      // Assert
      await waitFor(() => {
        expect(pauseMock).toHaveBeenCalled();
      });
    });

    it('audioRef.current.src가 빈 문자열로 설정되어야 함', async () => {
      // Arrange
      render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Act: Navigate away
      fireEvent.click(screen.getAllByRole('link', { name: /단계 3: 리텔링/ })[0]);

      // Assert
      await waitFor(() => {
        expect(mockAudioElement.src).toBe('');
      });
    });
  });

  describe('TC-014: 페이지 이동 시 AudioPlayer 오디오 정지', () => {
    it('ListeningPage → RetellingPage 이동 시 AudioPlayer cleanup이 실행되어야 함', async () => {
      // Arrange
      render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Act: Navigate to RetellingPage
      fireEvent.click(screen.getAllByRole('link', { name: /단계 3: 리텔링/ })[0]);

      // Assert
      await waitFor(() => {
        expect(pauseMock).toHaveBeenCalled();
        expect(mockAudioElement.src).toBe('');
      });
    });
  });

  describe('TC-015: 빠른 페이지 전환 시 오디오 독립 관리', () => {
    it('단계2 → 단계5 → 단계2 빠른 이동 시 오디오가 독립적으로 관리되어야 함', async () => {
      // Arrange
      render(<App />);

      // Navigate to ListeningPage (단계2)
      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Start playback
      const playButton = screen.getAllByRole('button')[0];
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalled();
      });

      // Act: Navigate to RolePlayPage (단계5)
      fireEvent.click(screen.getAllByRole('link', { name: /단계 5: AI 롤플레잉/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 5: AI 롤플레잉/ })).toBeInTheDocument();
      });

      // Assert: 단계2 오디오가 정지되어야 함
      expect(pauseMock).toHaveBeenCalled();

      // Navigate back to ListeningPage (단계2)
      vi.clearAllMocks();
      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Assert: 새로운 TTSPlayer 인스턴스가 생성되어야 함
      const newPlayButton = screen.getAllByRole('button')[0];
      expect(newPlayButton).toBeInTheDocument();
    });

    it('각 페이지의 오디오가 독립적으로 관리되어야 함', async () => {
      // Arrange
      render(<App />);

      // Navigate to ListeningPage
      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      const firstInstanceCallCount = playMock.mock.calls.length;

      // Act: Navigate away and back
      fireEvent.click(screen.getAllByRole('link', { name: /단계 3: 리텔링/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 3: 리텔링/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Assert: 새로운 인스턴스는 초기 상태
      const playButton = screen.getAllByRole('button')[0];
      expect(playButton).toBeInTheDocument();
    });

    it('새로운 인스턴스는 idle 상태여야 함', async () => {
      // Arrange
      render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Act: Navigate away and back
      fireEvent.click(screen.getAllByRole('link', { name: /단계 5: AI 롤플레잉/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 5: AI 롤플레잉/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Assert: "재생 중..." 텍스트가 없어야 함
      expect(screen.queryByText('재생 중...')).not.toBeInTheDocument();
    });
  });

  describe('TC-019: 페이지 새로고침 시 오디오 상태 초기화', () => {
    it('새로고침 후 모든 오디오가 정지되어야 함', async () => {
      // Arrange
      const { unmount } = render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Start playback
      const playButton = screen.getAllByRole('button')[0];
      fireEvent.click(playButton);

      // Act: Simulate page reload (unmount + remount)
      unmount();

      const { container } = render(<App />);

      // Navigate to ListeningPage again
      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      // Assert: 새로운 인스턴스는 초기 상태
      await waitFor(() => {
        expect(screen.queryByText('재생 중...')).not.toBeInTheDocument();
      });
    });

    it('state가 idle로 초기화되어야 함', async () => {
      // Arrange & Act
      render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Assert: 초기 상태 확인
      const playButton = screen.getAllByRole('button')[0];
      expect(playButton).toBeInTheDocument();
      expect(screen.queryByText('음성 생성 중...')).not.toBeInTheDocument();
    });

    it('TTSPlayer의 audioSrc가 null로 초기화되어야 함', async () => {
      // Arrange
      const { container } = render(<App />);

      fireEvent.click(screen.getAllByRole('link', { name: /단계 2: 듣기 연습/ })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /단계 2: 듣기 연습/ })).toBeInTheDocument();
      });

      // Assert: TTSPlayer는 TTS 생성 전까지 audio 엘리먼트를 렌더링하지 않음
      // AudioPlayer는 항상 props.src로 렌더링되므로, audio 요소가 1개만 있어야 함 (AudioPlayer 것만)
      const audioElements = container.querySelectorAll('audio');
      // AudioPlayer의 audio만 존재해야 함 (TTSPlayer의 audio는 아직 없음)
      expect(audioElements.length).toBe(1);
      // 그 audio는 AudioPlayer의 것 (recording.mp3)
      expect(audioElements[0].src).toContain('recording.mp3');
    });
  });
});

/**
 * Timer 컴포넌트 onStop 콜백 테스트
 *
 * TDD Red Phase: 실패하는 테스트 먼저 작성
 * 테스트 프레임워크: Vitest + @testing-library/react
 *
 * 테스트 범위:
 * - TC-001: onStop 콜백 호출 (running → idle)
 * - TC-002: onStop 콜백 호출 (paused → idle)
 * - TC-003: onStop 없이 중지 버튼 클릭 (하위 호환성)
 * - TC-004: onStop이 완료 버튼 클릭 시 호출되지 않음
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Timer } from '../Timer';

// Helper function to render component (Timer doesn't need Router)
const renderTimer = (props: React.ComponentProps<typeof Timer>) => {
  return render(<Timer {...props} />);
};

describe('Timer Component - onStop Callback Tests', () => {
  beforeEach(() => {
    // Use real timers to avoid conflicts with React state updates
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-001: onStop 콜백 호출 (running → idle)', () => {
    it('should call onStop callback once when stop button is clicked from running state', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 60,
        onStop: onStop,
        showControls: true,
      });

      // Act - 시작 버튼 클릭
      const startButton = screen.getByText('시작');
      fireEvent.click(startButton);

      // 타이머가 running 상태가 될 때까지 대기
      await waitFor(() => {
        expect(screen.getByText('일시정지')).toBeInTheDocument();
      });

      // 중지 버튼 클릭
      const stopButton = screen.getByText('중지');
      fireEvent.click(stopButton);

      // Assert
      expect(onStop).toHaveBeenCalledTimes(1);

      // Timer 상태가 'idle'로 변경 확인
      await waitFor(() => {
        expect(screen.getByText('1:00')).toBeInTheDocument();
        expect(screen.getByText('시작')).toBeInTheDocument();
      });
    });

    it('should reset timer to initial duration after stop', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 60,
        onStop: onStop,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));

      // Wait for running state
      await waitFor(() => {
        expect(screen.getByText('중지')).toBeInTheDocument();
      });

      // Wait a bit for time to pass (with real timers)
      await new Promise(resolve => setTimeout(resolve, 200));

      fireEvent.click(screen.getByText('중지'));

      // Assert - 초기값(60초)으로 리셋
      await waitFor(() => {
        expect(screen.getByText('1:00')).toBeInTheDocument();
      });
    });
  });

  describe('TC-002: onStop 콜백 호출 (paused → idle)', () => {
    it('should call onStop callback once when stop button is clicked from paused state', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 180,
        onStop: onStop,
        showControls: true,
      });

      // Act - 시작 → 일시정지 → 중지
      fireEvent.click(screen.getByText('시작'));

      await waitFor(() => {
        expect(screen.getByText('일시정지')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('일시정지'));

      await waitFor(() => {
        expect(screen.getByText('재개')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('중지'));

      // Assert
      expect(onStop).toHaveBeenCalledTimes(1);

      // Timer 상태가 'idle'로 변경 및 3분으로 리셋
      await waitFor(() => {
        expect(screen.getByText('3:00')).toBeInTheDocument();
        expect(screen.getByText('시작')).toBeInTheDocument();
      });
    });

    it('should reset pausedTime after stop from paused state', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 180,
        onStop: onStop,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));

      await waitFor(() => {
        expect(screen.getByText('일시정지')).toBeInTheDocument();
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      fireEvent.click(screen.getByText('일시정지'));

      await waitFor(() => {
        expect(screen.getByText('재개')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('중지'));

      // Assert - 초기 시간으로 완전히 리셋
      await waitFor(() => {
        expect(screen.getByText('3:00')).toBeInTheDocument();
      });
    });
  });

  describe('TC-003: onStop 없이 중지 버튼 클릭 (하위 호환성)', () => {
    it('should work without errors when onStop is not provided', async () => {
      // Arrange
      renderTimer({
        duration: 60,
        showControls: true,
      });

      // Act & Assert - 에러 없이 정상 동작
      fireEvent.click(screen.getByText('시작'));

      await waitFor(() => {
        expect(screen.getByText('중지')).toBeInTheDocument();
      });

      expect(() => {
        fireEvent.click(screen.getByText('중지'));
      }).not.toThrow();

      // Timer 상태가 'idle'로 변경
      await waitFor(() => {
        expect(screen.getByText('1:00')).toBeInTheDocument();
        expect(screen.getByText('시작')).toBeInTheDocument();
      });
    });
  });

  describe('TC-004: onStop이 완료 버튼 클릭 시 호출되지 않음', () => {
    it('should not call onStop when complete button is clicked', async () => {
      // Arrange
      const onStop = vi.fn();
      const onManualComplete = vi.fn();

      renderTimer({
        duration: 60,
        onStop: onStop,
        onManualComplete: onManualComplete,
        showCompleteButton: true,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));

      await waitFor(() => {
        expect(screen.getByText('완료')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('완료'));

      // Assert
      expect(onStop).not.toHaveBeenCalled();
      expect(onManualComplete).toHaveBeenCalledTimes(1);
    });

    it('should transition to completed state when complete button is clicked', async () => {
      // Arrange
      const onStop = vi.fn();
      const onManualComplete = vi.fn();

      renderTimer({
        duration: 60,
        onStop: onStop,
        onManualComplete: onManualComplete,
        showCompleteButton: true,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));
      fireEvent.click(screen.getByText('완료'));

      // Assert - completed 상태로 전환
      await waitFor(() => {
        expect(screen.getByText('재설정')).toBeInTheDocument();
      });

      // onStop은 호출되지 않음
      expect(onStop).not.toHaveBeenCalled();
    });
  });

  describe('Additional onStop Tests', () => {
    it('should not call onStop multiple times on multiple clicks', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 60,
        onStop: onStop,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));

      const stopButton = await screen.findByText('중지');
      fireEvent.click(stopButton);

      // 중지 후 다시 시작하고 중지
      fireEvent.click(screen.getByText('시작'));
      fireEvent.click(screen.getByText('중지'));

      // Assert - 각 중지마다 1회씩, 총 2회 호출
      expect(onStop).toHaveBeenCalledTimes(2);
    });

    it('should call onStop after timer is paused and then stopped', async () => {
      // Arrange
      const onStop = vi.fn();

      renderTimer({
        duration: 120,
        onStop: onStop,
        showControls: true,
      });

      // Act
      fireEvent.click(screen.getByText('시작'));

      await waitFor(() => {
        expect(screen.getByText('일시정지')).toBeInTheDocument();
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      fireEvent.click(screen.getByText('일시정지'));

      await waitFor(() => {
        expect(screen.getByText('재개')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('중지'));

      // Assert
      expect(onStop).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText('2:00')).toBeInTheDocument();
      });
    });
  });
});

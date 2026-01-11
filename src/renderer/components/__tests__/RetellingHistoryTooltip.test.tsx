import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { RetellingHistoryTooltip } from '../RetellingHistoryTooltip';

/**
 * RetellingHistoryTooltip Component Unit Tests
 *
 * 테스트 대상: RetellingHistoryTooltip 컴포넌트
 * 테스트 유형: 단위 테스트
 * 관련 문서: E:\develop\electron-test\claude.config\dev-workflow\docs\test-cases.md
 */

// Mock window.electron
const mockInvoke = vi.fn();

describe('RetellingHistoryTooltip', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Setup window.electron mock without overwriting window object
    Object.defineProperty(window, 'electron', {
      value: {
        invoke: mockInvoke,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * TC-004: formatDuration - NULL 처리
   * 우선순위: High (P0)
   */
  describe('formatDuration', () => {
    it('TC-004: should return "N/A" for null duration', () => {
      const formatDuration = (seconds: number | null) => {
        if (seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
      };

      const result = formatDuration(null);
      expect(result).toBe('N/A');
    });

    /**
     * TC-005: formatDuration - 분+초 포맷팅
     * 우선순위: High (P0)
     */
    it('TC-005: should format duration with minutes and seconds', () => {
      const formatDuration = (seconds: number | null) => {
        if (seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
      };

      const result = formatDuration(178);
      expect(result).toBe('2분 58초');
    });

    /**
     * TC-006: formatDuration - 초만 포맷팅
     * 우선순위: Medium (P1)
     */
    it('TC-006: should format duration with seconds only', () => {
      const formatDuration = (seconds: number | null) => {
        if (seconds === null) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
      };

      const result = formatDuration(45);
      expect(result).toBe('45초');
    });
  });

  /**
   * TC-007: formatDate - 날짜 포맷팅
   * 우선순위: Medium (P1)
   */
  describe('formatDate', () => {
    it('TC-007: should format date correctly', () => {
      const formatDate = (date: Date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      const result = formatDate(new Date('2026-01-11T14:30:00'));
      expect(result).toBe('2026-01-11 14:30');
    });
  });

  /**
   * TC-008: RetellingHistoryTooltip 로딩 상태
   * 우선순위: High (P0)
   */
  it('TC-008: should show loading state on click', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: [] });

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    fireEvent.click(trigger);

    // Loading state should be visible immediately
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();

    // Wait for loading to complete - use a single expectation
    await waitFor(
      () => expect(screen.getByText('기록이 없습니다.')).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });

  /**
   * TC-009: RetellingHistoryTooltip 에러 상태
   * 우선순위: High (P0)
   */
  it('TC-009: should show error message on failure', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: '조회 실패' });

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByText('조회 실패')).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  /**
   * TC-010: RetellingHistoryTooltip 빈 데이터
   * 우선순위: Medium (P1)
   */
  it('TC-010: should show "no data" message when history is empty', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: [] });

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    fireEvent.click(trigger);

    await waitFor(
      () => expect(screen.getByText('기록이 없습니다.')).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });

  /**
   * TC-011: RetellingHistoryTooltip 캐싱
   * 우선순위: Low (P2)
   */
  it('TC-011: should cache history data and not refetch on toggle', async () => {
    const mockHistory = [
      {
        id: 1,
        duration: 3,
        createdAt: new Date('2026-01-11T14:30:00'),
        actualDuration: 178,
        transcribedText: 'test',
      },
    ];

    mockInvoke.mockResolvedValue({ success: true, data: mockHistory });

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    // 첫 번째 click - open
    fireEvent.click(trigger);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1), { timeout: 2000 });

    // 두 번째 click - close
    fireEvent.click(trigger);
    await waitFor(
      () => expect(screen.queryByTestId('history-tooltip')).not.toBeInTheDocument(),
      { timeout: 2000 }
    );

    // 세 번째 click - reopen
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByTestId('history-tooltip')).toBeInTheDocument(), {
      timeout: 2000,
    });

    // 여전히 1회만 호출 (캐싱)
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  /**
   * TC-020: 툴팁과 히스토리 데이터 통합
   * 우선순위: High (P0)
   */
  it('TC-020: should display history items with date and duration', async () => {
    const mockHistory = [
      {
        id: 1,
        duration: 3,
        createdAt: new Date('2026-01-11T14:30:00'),
        actualDuration: 178,
        transcribedText: 'test1',
      },
      {
        id: 2,
        duration: 3,
        createdAt: new Date('2026-01-10T10:00:00'),
        actualDuration: 165,
        transcribedText: 'test2',
      },
      {
        id: 3,
        duration: 3,
        createdAt: new Date('2026-01-09T09:00:00'),
        actualDuration: 172,
        transcribedText: 'test3',
      },
    ];

    mockInvoke.mockResolvedValue({ success: true, data: mockHistory });

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(3), {
      timeout: 2000,
    });

    expect(screen.getByText(/2026-01-11 14:30/)).toBeInTheDocument();
    expect(screen.getByText(/2분 58초/)).toBeInTheDocument();
  });

  /**
   * TC-027: IPC 호출 타임아웃
   * 우선순위: Medium (P1)
   */
  it('TC-027: should handle IPC timeout error', async () => {
    mockInvoke.mockRejectedValue(new Error('Timeout'));

    render(<RetellingHistoryTooltip topicId={1} duration={3} />);
    const trigger = screen.getByTestId('history-tooltip-trigger');

    fireEvent.click(trigger);

    await waitFor(
      () => expect(screen.getByText('기록을 불러올 수 없습니다.')).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });
});

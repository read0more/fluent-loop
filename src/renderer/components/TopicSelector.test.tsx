/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopicSelector } from './TopicSelector';
import { Topic } from '../../main/database/models';

// Mock Electron IPC
const mockInvoke = vi.fn();
(window as any).electron = {
  invoke: mockInvoke,
};

// Mock 데이터
const mockTopics: Topic[] = [
  {
    id: 1,
    title: '여행 계획 세우기...',
    koreanContent: '여행에 대한 한국어 내용',
    englishContent: 'Travel planning content in English',
    cefrLevel: 'B1',
    keywords: ['travel', 'planning'],
    recordingPath: '/path/to/audio1.m4a',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    status: 'active',
    weekStartDate: new Date('2026-01-15T10:00:00.000Z'),
  },
  {
    id: 2,
    title: '취미 이야기...',
    koreanContent: '취미에 대한 한국어 내용',
    englishContent: 'Hobby content in English',
    cefrLevel: 'B2',
    keywords: ['hobby', 'interests'],
    recordingPath: '/path/to/audio2.m4a',
    createdAt: new Date('2026-01-10T10:00:00.000Z'),
    updatedAt: new Date('2026-01-10T10:00:00.000Z'),
    status: 'inactive',
    weekStartDate: null,
  },
];

describe.skip('TopicSelector', () => {
  const mockOnTopicSelect = vi.fn();

  beforeEach(() => {
    mockInvoke.mockClear();
    mockOnTopicSelect.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // TC-001: TopicSelector - 현재 활성 토픽 렌더링
  // ============================================================
  it('TC-001: should render current active topic in dropdown header', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockTopics,
    });

    render(
      <TopicSelector
        currentTopicId={1}
        onTopicSelect={mockOnTopicSelect}
        disabled={false}
      />
    );

    // 현재 토픽의 제목이 드롭다운 헤더에 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('여행 계획 세우기...')).toBeInTheDocument();
    });

    // CEFR 레벨 배지 표시 확인
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  // ============================================================
  // TC-002: TopicSelector - 토픽 목록 로드
  // ============================================================
  it('TC-002: should load topics on mount', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockTopics,
    });

    render(
      <TopicSelector
        currentTopicId={null}
        onTopicSelect={mockOnTopicSelect}
      />
    );

    // get-all-topics IPC 호출 확인
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get-all-topics');
    });

    // 드롭다운 열기
    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    // 모든 토픽이 드롭다운 리스트에 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('여행 계획 세우기...')).toBeInTheDocument();
      expect(screen.getByText('취미 이야기...')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TC-003: TopicSelector - 토픽 선택 이벤트
  // ============================================================
  it('TC-003: should call onTopicSelect when topic is clicked', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockTopics,
    });

    render(
      <TopicSelector
        currentTopicId={1}
        onTopicSelect={mockOnTopicSelect}
      />
    );

    // 드롭다운 열기
    const dropdownButton = screen.getByRole('button');
    await waitFor(() => {
      expect(screen.getByText('여행 계획 세우기...')).toBeInTheDocument();
    });
    fireEvent.click(dropdownButton);

    // 다른 토픽 선택
    await waitFor(() => {
      expect(screen.getByText('취미 이야기...')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('취미 이야기...'));

    // onTopicSelect 콜백 호출 확인
    expect(mockOnTopicSelect).toHaveBeenCalledWith(2);
  });

  // ============================================================
  // TC-004: TopicSelector - 비활성화 상태
  // ============================================================
  it('TC-004: should be disabled when disabled prop is true', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockTopics,
    });

    render(
      <TopicSelector
        currentTopicId={1}
        onTopicSelect={mockOnTopicSelect}
        disabled={true}
      />
    );

    // 드롭다운 헤더 버튼이 disabled 상태인지 확인
    const dropdownButton = screen.getByRole('button');
    expect(dropdownButton).toBeDisabled();
  });

  // ============================================================
  // TC-005: TopicSelector - 에러 메시지 표시
  // ============================================================
  it('TC-005: should display error message on load failure', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: '토픽 목록 조회 실패',
    });

    render(
      <TopicSelector
        currentTopicId={null}
        onTopicSelect={mockOnTopicSelect}
      />
    );

    // 에러 메시지가 UI에 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('토픽 목록 조회 실패')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TC-006: TopicSelector - 빈 토픽 목록
  // ============================================================
  it('TC-006: should show empty state when no topics exist', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: [],
    });

    render(
      <TopicSelector
        currentTopicId={null}
        onTopicSelect={mockOnTopicSelect}
      />
    );

    // 드롭다운 열기
    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    // 빈 상태 메시지 표시 확인
    await waitFor(() => {
      expect(screen.getByText('생성된 토픽이 없습니다')).toBeInTheDocument();
    });
  });
});

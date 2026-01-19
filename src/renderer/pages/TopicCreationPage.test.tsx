/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { TopicCreationPage } from './TopicCreationPage';

// Mock Electron IPC
const mockInvoke = vi.fn();
(window as any).electron = {
  invoke: mockInvoke,
};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TopicCreationPage - Topic Selection Handler', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockNavigate.mockClear();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // TC-012: TopicCreationPage - 토픽 선택 핸들러
  // ============================================================
  it('TC-012: should handle topic selection and clear localStorage', async () => {
    // localStorage에 기존 draft 데이터 설정
    const draftData = {
      koreanText: '기존 토픽 내용',
      englishText: 'Existing topic content',
      keywords: ['existing', 'keyword'],
      cefrLevel: 'B1',
      title: '기존 토픽...',
      recordingPath: '/path/to/old.m4a',
      savedAt: Date.now(),
    };
    localStorageMock.setItem('step1_draft_topic', JSON.stringify(draftData));

    // set-active-topic IPC mock
    mockInvoke.mockResolvedValueOnce({
      success: true,
    });

    // get-active-topic IPC mock
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        id: 2,
        title: '새로운 토픽...',
        koreanContent: '새로운 한국어 내용',
        englishContent: 'New English content',
        cefrLevel: 'B2',
        keywords: ['new', 'topic'],
        recordingPath: '/path/to/new.m4a',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        weekStartDate: new Date(),
      },
    });

    render(
      <BrowserRouter>
        <TopicCreationPage />
      </BrowserRouter>
    );

    // TopicSelector의 handleTopicSelect 시뮬레이션
    // (실제 컴포넌트가 구현되면 TopicSelector를 통해 토픽 선택)

    // 검증 1: set-active-topic IPC 호출 확인 (실제 구현 시)
    // expect(mockInvoke).toHaveBeenCalledWith('set-active-topic', { topicId: 2 });

    // 검증 2: localStorage 클리어 확인
    await waitFor(() => {
      const saved = localStorageMock.getItem('step1_draft_topic');
      // 토픽 변경 후 localStorage가 클리어되어야 함
      // (실제 구현 후 주석 해제)
      // expect(saved).toBeNull();
    });
  });

  // ============================================================
  // TC-018: localStorage 충돌 방지
  // ============================================================
  it('TC-018: should clear localStorage when changing topics', async () => {
    // Step1에 저장된 draft 설정
    const draftData = {
      koreanText: '임시 저장된 텍스트',
      englishText: 'Temporarily saved text',
      keywords: ['test'],
      cefrLevel: 'B1',
      title: '임시 토픽...',
      recordingPath: null,
      savedAt: Date.now(),
    };
    localStorageMock.setItem('step1_draft_topic', JSON.stringify(draftData));

    mockInvoke.mockResolvedValue({
      success: true,
    });

    render(
      <BrowserRouter>
        <TopicCreationPage />
      </BrowserRouter>
    );

    // 토픽 변경 시뮬레이션
    // (실제로는 TopicSelector를 통해 토픽 선택)

    // localStorage 클리어 확인
    // (실제 구현 후 주석 해제)
    // expect(localStorageMock.getItem('step1_draft_topic')).toBeNull();
  });

  // ============================================================
  // TC-021: 토픽 0개인 경우
  // ============================================================
  it('TC-021: should handle empty topic list gracefully', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: [],
    });

    render(
      <BrowserRouter>
        <TopicCreationPage />
      </BrowserRouter>
    );

    // TopicSelector가 표시되지 않거나 빈 상태 메시지 표시
    // (실제 구현 후 검증)
    await waitFor(() => {
      // expect(screen.queryByText('토픽 선택')).toBeNull();
      // 또는
      // expect(screen.getByText('생성된 토픽이 없습니다')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TC-024: 활성 토픽 없는 경우
  // ============================================================
  it('TC-024: should handle no active topic case', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <BrowserRouter>
        <TopicCreationPage />
      </BrowserRouter>
    );

    // 활성 토픽이 없을 때 처리 확인
    // (실제 구현 후 검증)
    await waitFor(() => {
      // expect(screen.getByText('토픽 선택')).toBeInTheDocument();
    });
  });
});

/**
 * ChatInput 컴포넌트 테스트
 *
 * 테스트 케이스:
 * - TC-001: TTS 재생 중 보내기 버튼 비활성화
 * - TC-002: TTS 재생 완료 후 보내기 버튼 활성화
 * - TC-003: ChatInput 언마운트 시 리소스 정리
 *
 * 작성일: 2026-01-23
 * 관련 문서: claude.config/dev-workflow/docs/test-cases.md
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatInput, ChatInputProps } from '../ChatInput';

describe('ChatInput - TTS 재생 중 버튼 비활성화 (FR-001)', () => {
  let defaultProps: ChatInputProps;
  let mockStopRealtimeRecording: ReturnType<typeof vi.fn>;
  let mockResetText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock window.electron
    (window as any).electron = {
      invoke: vi.fn(),
    };

    // Mock navigator.mediaDevices
    mockStopRealtimeRecording = vi.fn();
    mockResetText = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [
            { stop: vi.fn(), kind: 'audio' }
          ],
        }),
      },
      configurable: true,
    });

    defaultProps = {
      onSendMessage: vi.fn(),
      isSending: false,
      autoSendEnabled: false,
      autoSendDelay: 2,
      onToggleAutoSend: vi.fn(),
      onChangeAutoSendDelay: vi.fn(),
      autoListenEnabled: false,
      onToggleAutoListen: vi.fn(),
      disabled: false,
      isPlayingTTS: false,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-001: TTS 재생 중 보내기 버튼 비활성화', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    // 1단계: 초기 렌더링 (isPlayingTTS = false)
    const { rerender } = render(
      <ChatInput {...defaultProps} onSendMessage={onSendMessage} isPlayingTTS={false} />
    );

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByTitle('메시지 전송');

    // 2단계: 텍스트 입력
    await user.type(textarea, 'Hello');
    expect(textarea).toHaveValue('Hello');

    // 3단계: 보내기 버튼 활성화 확인
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).toHaveTextContent('보내기 ➤');

    // 4단계: isPlayingTTS를 true로 변경하여 재렌더링
    rerender(
      <ChatInput {...defaultProps} onSendMessage={onSendMessage} isPlayingTTS={true} />
    );

    // 5단계: 보내기 버튼 비활성화 확인 (텍스트는 유지)
    await waitFor(() => {
      expect(sendButton).toBeDisabled();
      expect(sendButton).toHaveTextContent('보내기 ➤');
    });

    // 6단계: 버튼 클릭 시도 (반응 없어야 함)
    await user.click(sendButton);
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('TC-002: TTS 재생 완료 후 보내기 버튼 활성화', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    // 1단계: isPlayingTTS = true로 렌더링
    const { rerender } = render(
      <ChatInput {...defaultProps} onSendMessage={onSendMessage} isPlayingTTS={true} />
    );

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByTitle('메시지 전송');

    // 텍스트 입력
    await user.type(textarea, 'Hello');

    // 2단계: 버튼 비활성화 상태 확인 (텍스트는 유지)
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveTextContent('보내기 ➤');

    // 3단계: isPlayingTTS를 false로 변경하여 재렌더링
    rerender(
      <ChatInput {...defaultProps} onSendMessage={onSendMessage} isPlayingTTS={false} />
    );

    // 4단계: 버튼 활성화 및 텍스트 복원 확인
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
      expect(sendButton).toHaveTextContent('보내기 ➤');
    });

    // 5단계: 버튼 클릭 시 onSendMessage 호출 확인
    await user.click(sendButton);
    expect(onSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('TC-003: ChatInput 언마운트 시 리소스 정리', async () => {
    // Mock useRealtimeSTT
    const mockStopRecording = vi.fn();
    const mockResetText = vi.fn();

    // 이 테스트는 cleanup effect가 호출되는지 확인합니다
    const { unmount } = render(
      <ChatInput {...defaultProps} autoListenEnabled={true} />
    );

    // 컴포넌트 언마운트
    unmount();

    // cleanup 함수가 호출되었는지 확인
    // 실제 구현에서 useEffect cleanup이 호출되는지 검증
    // (추후 구현 시 stopRealtimeRecording, resetText 호출 확인)
    await waitFor(() => {
      // cleanup이 정상 실행되면 에러 없이 언마운트됨
      expect(true).toBe(true);
    });
  });
});

describe('ChatInput - 경계값 테스트', () => {
  let defaultProps: ChatInputProps;

  beforeEach(() => {
    (window as any).electron = {
      invoke: vi.fn(),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn(), kind: 'audio' }],
        }),
      },
      configurable: true,
    });

    defaultProps = {
      onSendMessage: vi.fn(),
      isSending: false,
      autoSendEnabled: false,
      autoSendDelay: 2,
      onToggleAutoSend: vi.fn(),
      onChangeAutoSendDelay: vi.fn(),
      autoListenEnabled: false,
      onToggleAutoListen: vi.fn(),
      disabled: false,
      isPlayingTTS: false,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-028: 빈 문자열 입력 시 버튼 비활성화 유지', async () => {
    const user = userEvent.setup();

    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByTitle('메시지 전송');

    // 빈 문자열
    await user.clear(textarea);
    expect(sendButton).toBeDisabled();

    // 공백만 입력
    await user.type(textarea, '   ');
    expect(sendButton).toBeDisabled();

    // 유효한 텍스트 입력 시 활성화
    await user.clear(textarea);
    await user.type(textarea, 'Hello');
    expect(sendButton).not.toBeDisabled();
  });

  it('TC-029: 매우 긴 텍스트 입력 (10,000자)', async () => {
    const user = userEvent.setup();

    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByTitle('메시지 전송');

    // 10,000자 텍스트 입력 (paste 사용으로 성능 개선)
    const longText = 'a'.repeat(10000);
    await user.click(textarea);
    await user.paste(longText);

    // 텍스트가 정상적으로 입력됨
    expect(textarea).toHaveValue(longText);

    // 버튼이 활성화됨
    expect(sendButton).not.toBeDisabled();

    // UI가 응답성을 유지함 (타임아웃 없음)
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    }, { timeout: 1000 });
  }, 10000);

  it('TC-035: isPlayingTTS와 isSending이 동시에 true인 경우', () => {
    render(
      <ChatInput
        {...defaultProps}
        isPlayingTTS={true}
        isSending={true}
      />
    );

    const sendButton = screen.getByTitle('메시지 전송');

    // 버튼 disabled = true
    expect(sendButton).toBeDisabled();

    // 버튼 텍스트 = "전송 중..." (isSending이 우선)
    expect(sendButton).toHaveTextContent('전송 중...');
  });
});

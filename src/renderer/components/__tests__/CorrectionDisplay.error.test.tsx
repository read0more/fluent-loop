/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CorrectionDisplay } from '../CorrectionDisplay';
import { CorrectionResult } from '../../../main/database/models';

/**
 * CorrectionDisplay - 에러 케이스 테스트
 *
 * 테스트 대상: TTS 기능의 에러 처리 및 복원
 *
 * 관련 TC:
 * - TC-037: Python 백엔드 미실행 시
 * - TC-038: TTS 생성 실패 (Python 에러)
 * - TC-039: Audio 파일 로드 실패
 * - TC-041: 네트워크 타임아웃
 */

describe('CorrectionDisplay - 에러 케이스 테스트', () => {
  const mockCorrections: CorrectionResult[] = [
    {
      original: 'Test sentence',
      corrected: 'Test sentence corrected',
      explanation: null
    }
  ];

  let mockOnPlayTTS: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockOnPlayTTS = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  /**
   * TC-037: Python 백엔드 미실행 시
   *
   * 사전 조건: Python 백엔드 중지 상태
   * 테스트 단계:
   *   1. TTS 요청
   *   2. 연결 에러 확인
   *   3. 에러 메시지 표시 확인
   * 예상 결과:
   *   - IPC 에러 반환: TTS_SERVICE_UNAVAILABLE
   *   - 버튼 상태 복원
   */
  it('TC-037: Python 백엔드 미실행 시', async () => {
    mockOnPlayTTS.mockRejectedValue({
      code: 'TTS_SERVICE_UNAVAILABLE',
      message: 'TTS 서버에 연결할 수 없습니다.'
    });

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    // 에러 후 상태 복원 확인
    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    // 에러 로깅 확인
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  /**
   * TC-038: TTS 생성 실패 (Python 에러)
   *
   * 사전 조건: Python 백엔드에서 음성 생성 실패
   * 테스트 단계:
   *   1. TTS 요청
   *   2. Python 에러 응답
   *   3. 에러 처리 확인
   * 예상 결과:
   *   - IPC 에러: TTS_SYNTHESIS_FAILED
   *   - 상태 복원
   */
  it('TC-038: TTS 생성 실패 (Python 에러)', async () => {
    mockOnPlayTTS.mockRejectedValue({
      code: 'TTS_SYNTHESIS_FAILED',
      message: '음성 생성에 실패했습니다.'
    });

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'TTS playback failed:',
      expect.objectContaining({
        code: 'TTS_SYNTHESIS_FAILED'
      })
    );
  });

  /**
   * TC-039: Audio 파일 로드 실패
   *
   * 사전 조건: TTS 파일 생성 성공, 파일 경로 잘못됨
   * 테스트 단계:
   *   1. TTS 생성 완료
   *   2. Audio 객체 로드 시도
   *   3. onerror 이벤트 발생
   * 예상 결과:
   *   - audio.onerror 호출
   *   - reject(new Error('오디오 재생 실패'))
   *   - 상태 복원
   */
  it('TC-039: Audio 파일 로드 실패', async () => {
    mockOnPlayTTS.mockRejectedValue(new Error('오디오 재생 실패'));

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'TTS playback failed:',
      expect.any(Error)
    );
  });

  /**
   * TC-040: 브라우저 자동재생 정책 차단
   *
   * 사전 조건: 브라우저 자동재생 정책 활성화
   * 테스트 단계:
   *   1. 사용자 상호작용 없이 재생 시도
   *   2. audio.play() rejection 확인
   * 예상 결과:
   *   - audio.play().catch() 호출
   *   - 상태 복원
   */
  it('TC-040: 브라우저 자동재생 정책 차단', async () => {
    mockOnPlayTTS.mockRejectedValue({
      name: 'NotAllowedError',
      message: '자동 재생이 차단되었습니다.'
    });

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  /**
   * TC-041: 네트워크 타임아웃
   *
   * 사전 조건: 네트워크 지연 시뮬레이션
   * 테스트 단계:
   *   1. 긴 텍스트 TTS 요청
   *   2. 타임아웃 대기 (30초)
   *   3. 에러 처리 확인
   * 예상 결과:
   *   - ETIMEDOUT 에러
   *   - 상태 복원
   */
  it('TC-041: 네트워크 타임아웃', async () => {
    mockOnPlayTTS.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: '처리 시간이 초과되었습니다.'
    });

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'TTS playback failed:',
      expect.objectContaining({
        code: 'ETIMEDOUT'
      })
    );
  });

  /**
   * TC-042: 메모리 부족 시 재생 실패
   *
   * 사전 조건: 시스템 메모리 부족 시뮬레이션
   * 테스트 단계:
   *   1. 대량 TTS 파일 생성
   *   2. 메모리 부족 상태 유도
   *   3. 에러 처리 확인
   * 예상 결과:
   *   - Audio 로드 실패
   *   - 적절한 에러 메시지
   *   - 리소스 정리
   */
  it('TC-042: 메모리 부족 시 재생 실패', async () => {
    mockOnPlayTTS.mockRejectedValue({
      name: 'QuotaExceededError',
      message: '메모리가 부족합니다.'
    });

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  /**
   * 연속 에러 발생 시 안정성 테스트
   */
  it('연속 에러 발생 시 버튼 상태 안정성', async () => {
    mockOnPlayTTS.mockRejectedValue(new Error('TTS failed'));

    render(
      <CorrectionDisplay
        corrections={mockCorrections}
        onPlayTTS={mockOnPlayTTS}
      />
    );

    const button = screen.getByTestId('play-tts-0');

    // 3번 연속 클릭
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent('🔊 듣기');
    });

    // 에러가 3번 로깅되었는지 확인
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });
});

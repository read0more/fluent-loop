import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AutoSendToggle } from './AutoSendToggle';
import { AutoListenToggle } from './AutoListenToggle';
import { useAutoSend } from '../../hooks/useAutoSend';
import { useSilenceDetection } from '../../hooks/useSilenceDetection';
import { useRealtimeSTT } from '../../hooks/useRealtimeSTT';
import styles from './ChatInput.module.scss';

export interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isSending: boolean;
  autoSendEnabled: boolean;
  autoSendDelay: number;
  onToggleAutoSend: (enabled: boolean) => void;
  onChangeAutoSendDelay: (delay: number) => void;
  autoListenEnabled: boolean;
  onToggleAutoListen: (enabled: boolean) => void;
  disabled?: boolean;
  isPlayingTTS?: boolean;
  isLoading?: boolean;
}

/**
 * 음성/텍스트 입력 및 메시지 전송
 * 자동 전송 타이머 관리
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isSending,
  autoSendEnabled,
  autoSendDelay,
  onToggleAutoSend,
  onChangeAutoSendDelay,
  autoListenEnabled,
  onToggleAutoListen,
  disabled = false,
  isPlayingTTS = false,
  isLoading = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false); // STT 텍스트 정규화 중
  const autoSendOnCompleteRef = useRef(false); // 침묵 감지로 인한 자동 전송 플래그
  const silenceStoppedRef = useRef(false); // 침묵으로 녹음이 중지되었는지 여부
  const prevAutoSendEnabledRef = useRef(autoSendEnabled); // 이전 autoSendEnabled 값 추적

  // 실시간 STT 훅 (영어, 2.5초 간격)
  const {
    text: realtimeText,
    isRecording,
    isProcessing,
    error: realtimeError,
    stream,
    startRecording: startRealtimeRecording,
    stopRecording: stopRealtimeRecording,
    resetText,
    cleanup: cleanupSTT,
  } = useRealtimeSTT('en', 2500);

  // 자동 전송 훅 (텍스트 입력 후 자동 전송용 - 기존 로직)
  const { startTimer, stopTimer } = useAutoSend(autoSendEnabled, autoSendDelay);

  // stopRecording 함수를 ref로 저장 (침묵 감지 콜백에서 사용)
  const stopRecordingRef = useRef<(() => void) | null>(null);

  // 침묵 감지 훅 (항상 활성화 - 녹음 자동 중지용)
  const { startDetection, stopDetection } = useSilenceDetection(
    {
      enabled: true, // 항상 활성화하여 침묵 시 녹음 자동 중지
      silenceDelay: autoSendDelay,
      threshold: 15, // 고정 임계값
    },
    // 침묵 감지 시 콜백 (soundDetected가 이미 소리 감지를 보장하므로 inputText 체크 불필요)
    useCallback(() => {
      console.log('[ChatInput] Silence detected, stopping recording');
      autoSendOnCompleteRef.current = autoSendEnabled; // autoSend ON일 때만 자동 전송
      silenceStoppedRef.current = true; // 침묵으로 중지됨 표시
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
      }
    }, [autoSendEnabled])
  );

  // 메시지 전송 핸들러
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isSending || isNormalizing) return;

    onSendMessage(inputText.trim());
    setInputText('');
    resetText();
    setLocalError(null);
    stopTimer();
  }, [inputText, isSending, isNormalizing, onSendMessage, resetText, stopTimer]);

  // 실시간 텍스트를 inputText에 동기화
  useEffect(() => {
    // 녹음 중이거나 처리 중일 때만 STT 텍스트를 input에 동기화
    // 전송 후에는 동기화하지 않음 (이미 메시지로 전송됨)
    if (realtimeText && (isRecording || isProcessing)) {
      setInputText(realtimeText);
    }
  }, [realtimeText, isRecording, isProcessing]);

  // 자동 전송 트리거 (녹음 중이 아닐 때만)
  useEffect(() => {
    // autoSendEnabled가 방금 변경되었는지 확인
    const justToggled = prevAutoSendEnabledRef.current !== autoSendEnabled;
    prevAutoSendEnabledRef.current = autoSendEnabled;

    // 토글로 인한 변경이면 타이머 시작하지 않음
    if (justToggled) {
      return;
    }

    // 정규화 중이면 타이머 시작하지 않음
    if (autoSendEnabled && inputText.trim() && !isRecording && !isProcessing && !isNormalizing) {
      startTimer(handleSend);
    }
  }, [inputText, autoSendEnabled, isRecording, isProcessing, isNormalizing, startTimer, handleSend]);

  // 자동 듣기 모드: 페이지 진입 시 및 STT 완료 후 자동 녹음 시작
  useEffect(() => {
    // 침묵으로 중지된 경우 자동 재시작하지 않음
    if (silenceStoppedRef.current) {
      return;
    }

    // 조건: autoListen 활성화, 녹음 중 아님, 처리 중 아님, 비활성화 아님, 전송 중 아님, TTS 재생 중 아님
    if (autoListenEnabled && !isRecording && !isProcessing && !disabled && !isSending && !isPlayingTTS) {
      // 약간의 딜레이 후 녹음 시작 (STT 완료 직후 바로 시작하지 않도록)
      const timer = setTimeout(() => {
        startRealtimeRecording();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoListenEnabled, isRecording, isProcessing, disabled, isSending, isPlayingTTS, startRealtimeRecording]);

  // AI 응답 완료 후 (disabled 해제 + isSending 완료) 플래그 초기화
  useEffect(() => {
    if (!disabled && !isSending) {
      // "내 차례"가 시작되었으므로 플래그 초기화
      silenceStoppedRef.current = false;
    }
  }, [disabled, isSending]);

  // 침묵 감지로 인한 녹음 중지 및 자동 전송 래퍼
  const handleStopRecording = useCallback(async () => {
    // ★ 핵심 수정: 녹음 중지 처리 시작 시점에 바로 isNormalizing=true 설정
    // 자동 전송 useEffect가 중간 텍스트로 타이머를 시작하지 않도록 방지
    setIsNormalizing(true);

    stopDetection();

    // stopRecording이 마지막 STT 결과까지 포함된 텍스트 반환
    const finalText = await stopRealtimeRecording();

    // 빈 텍스트면 정규화 상태 해제하고 종료
    if (!finalText.trim()) {
      setIsNormalizing(false);
      return;
    }

    // 자동 전송 플래그 저장 후 리셋
    const shouldAutoSend = autoSendOnCompleteRef.current;
    autoSendOnCompleteRef.current = false;

    // STT 텍스트 정규화 (구두점/포맷팅 교정) - 항상 실행
    try {
      const response = await window.electron.invoke('normalize-stt-text', { text: finalText.trim() });
      const normalizedText = response.success && response.data?.normalizedText
        ? response.data.normalizedText
        : finalText.trim();

      if (shouldAutoSend) {
        // 자동 전송: 정규화된 텍스트로 직접 메시지 전송
        // useEffect 의존하지 않고 즉시 전송 (race condition 방지)
        onSendMessage(normalizedText);
        setInputText('');
        resetText();
        setLocalError(null);
        stopTimer();
      } else {
        // 수동 전송 대기: 정규화된 텍스트를 input에 표시
        setInputText(normalizedText);
        resetText();
        stopTimer();
      }
    } catch (error) {
      console.error('[ChatInput] Text normalization failed:', error);
      // 정규화 실패 시에도 동일한 로직 적용
      if (shouldAutoSend) {
        onSendMessage(finalText.trim());
        setInputText('');
        resetText();
        setLocalError(null);
        stopTimer();
      } else {
        setInputText(finalText.trim());
        resetText();
        stopTimer();
      }
    } finally {
      setIsNormalizing(false);
    }
  }, [stopDetection, stopRealtimeRecording, resetText, stopTimer, onSendMessage]);

  // stopRecording을 ref에 저장 (침묵 감지 콜백에서 참조)
  useEffect(() => {
    stopRecordingRef.current = handleStopRecording;
  }, [handleStopRecording]);

  // stream이 준비되면 침묵 감지 시작 (항상 활성화)
  useEffect(() => {
    if (stream && isRecording) {
      startDetection(stream);
    }
    return () => stopDetection();
  }, [stream, isRecording, startDetection, stopDetection]);

  // 컴포넌트 언마운트 시 STT 리소스 명시적 정리
  useEffect(() => {
    return () => {
      cleanupSTT();
    };
  }, [cleanupSTT]);

  // 엔터키로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending;

  // 에러 통합 (로컬 에러 또는 실시간 STT 에러)
  const displayError = localError || realtimeError;

  return (
    <div className={styles.input}>
      {displayError && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {displayError}
          <button onClick={() => setLocalError(null)} className={styles.errorClose}>
            ✕
          </button>
        </div>
      )}

      <div className={styles.controls}>
        {/* 토글 그룹 (세로 배치) */}
        <div className={styles.togglesGroup}>
          <AutoListenToggle enabled={autoListenEnabled} onToggle={onToggleAutoListen} />
          <AutoSendToggle
            enabled={autoSendEnabled}
            onToggle={onToggleAutoSend}
          />
        </div>

        {/* 녹음 버튼 */}
        <button
          className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
          onClick={() => {
            if (!isRecording) {
              startRealtimeRecording();
            } else {
              // 수동 중지 시 자동 전송 플래그 초기화
              autoSendOnCompleteRef.current = false;
              handleStopRecording();
            }
          }}
          disabled={isDisabled}
          title={!isRecording ? '음성 녹음' : '녹음 중지'}
        >
          {!isRecording && !isProcessing && '🎤'}
          {isRecording && (
            <>
              <span className={styles.recordingPulse}></span>
              🎤
            </>
          )}
          {isProcessing && !isRecording && '⏳'}
        </button>

        {/* 텍스트 입력 */}
        <textarea
          className={styles.messageInput}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isRecording
              ? '실시간 음성 인식 중...'
              : isProcessing
                ? '음성을 텍스트로 변환 중...'
                : '메시지를 입력하거나 음성으로 녹음하세요'
          }
          disabled={isDisabled || isNormalizing}
          rows={2}
        />

        {/* 침묵 감지 컨트롤 */}
        <div className={styles.silenceControl}>
          <span className={styles.silenceLabel}>침묵 감지</span>
          <span
            className={styles.silenceIcon}
            title="설정된 시간 동안 말이 없으면 녹음이 자동 중지됩니다"
          >
            🔇
          </span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={autoSendDelay}
            onChange={(e) => onChangeAutoSendDelay(parseFloat(e.target.value))}
            className={styles.silenceSlider}
          />
          <span className={styles.silenceValue}>{autoSendDelay}초</span>
        </div>

        {/* 전송 버튼 */}
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!inputText.trim() || isDisabled || isRecording || isPlayingTTS || isNormalizing}
          title="메시지 전송"
        >
          {isSending ? '전송 중...' : '보내기 ➤'}
        </button>
      </div>

      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span className={styles.recordingDot}></span>
          실시간 녹음 중... (클릭하여 중지)
        </div>
      )}
    </div>
  );
};

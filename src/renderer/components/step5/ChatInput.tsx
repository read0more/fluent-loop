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
  const autoSendOnCompleteRef = useRef(false); // 침묵 감지로 인한 자동 전송 플래그
  const silenceStoppedRef = useRef(false); // 침묵으로 녹음이 중지되었는지 여부

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
    if (!inputText.trim() || isSending) return;

    onSendMessage(inputText.trim());
    setInputText('');
    resetText();
    setLocalError(null);
    stopTimer();
  }, [inputText, isSending, onSendMessage, resetText, stopTimer]);

  // 실시간 텍스트를 inputText에 동기화
  useEffect(() => {
    if (realtimeText) {
      setInputText(realtimeText);
    }
  }, [realtimeText]);

  // 자동 전송 트리거 (녹음 중이 아닐 때만)
  useEffect(() => {
    if (autoSendEnabled && inputText.trim() && !isRecording && !isProcessing) {
      startTimer(handleSend);
    }
  }, [inputText, autoSendEnabled, isRecording, isProcessing, startTimer, handleSend]);

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
  const handleStopRecording = useCallback(() => {
    stopDetection();
    stopRealtimeRecording();

    // 침묵 감지로 인한 자동 전송인 경우
    if (autoSendOnCompleteRef.current && inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
      resetText();
      autoSendOnCompleteRef.current = false;
    }
  }, [stopDetection, stopRealtimeRecording, inputText, onSendMessage, resetText]);

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

  // 엔터키로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!autoSendEnabled) {
        handleSend();
      }
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
          disabled={isDisabled}
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
          disabled={!inputText.trim() || isDisabled || isRecording || isPlayingTTS}
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

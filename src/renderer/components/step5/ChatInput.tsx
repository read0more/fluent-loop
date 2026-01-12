import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AutoSendToggle } from './AutoSendToggle';
import { AutoListenToggle } from './AutoListenToggle';
import { useAutoSend } from '../../hooks/useAutoSend';
import { useSilenceDetection } from '../../hooks/useSilenceDetection';
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
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

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
}) => {
  const [inputText, setInputText] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoSendOnCompleteRef = useRef(false); // 침묵 감지로 인한 자동 전송 플래그

  // 자동 전송 훅 (텍스트 입력 후 자동 전송용 - 기존 로직)
  const { startTimer, stopTimer } = useAutoSend(autoSendEnabled, autoSendDelay);

  // stopRecording 함수를 ref로 저장 (침묵 감지 콜백에서 사용)
  const stopRecordingRef = useRef<(() => void) | null>(null);

  // 침묵 감지 훅 (자동전송 ON일 때만 활성화)
  const { startDetection, stopDetection } = useSilenceDetection(
    {
      enabled: autoSendEnabled,
      silenceDelay: autoSendDelay,
      threshold: 15, // 고정 임계값
    },
    // 침묵 감지 시 콜백
    useCallback(() => {
      autoSendOnCompleteRef.current = true; // 자동 전송 플래그 설정
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
      }
    }, [])
  );

  // 메시지 전송 핸들러
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isSending) return;

    onSendMessage(inputText.trim());
    setInputText('');
    setError(null);
    stopTimer();
  }, [inputText, isSending, onSendMessage, stopTimer]);

  // 자동 전송 트리거
  useEffect(() => {
    if (autoSendEnabled && inputText.trim() && recordingState === 'idle') {
      startTimer(handleSend);
    }
  }, [inputText, autoSendEnabled, recordingState, startTimer, handleSend]);

  // 자동 듣기 모드: 페이지 진입 시 및 STT 완료 후 자동 녹음 시작
  useEffect(() => {
    // 조건: autoListen 활성화, idle 상태, 비활성화 아님, 전송 중 아님
    if (autoListenEnabled && recordingState === 'idle' && !disabled && !isSending) {
      // 약간의 딜레이 후 녹음 시작 (STT 완료 직후 바로 시작하지 않도록)
      const timer = setTimeout(() => {
        startRecording();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoListenEnabled, recordingState, disabled, isSending]);

  // 녹음 시작 (Step3 RetellingPage와 동일한 방식)
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // stream 저장 (침묵 감지용)
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Step3과 동일하게 1초마다 데이터 수집

      setRecordingState('recording');
      setError(null);

      // 자동전송 ON이면 침묵 감지 시작
      if (autoSendEnabled) {
        startDetection(stream);
      }
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      setError('마이크 접근 권한이 필요합니다.');
    }
  }, [autoSendEnabled, startDetection]);

  // 녹음 중지 및 STT 변환 (Step3 RetellingPage와 동일한 방식)
  const stopRecording = useCallback(() => {
    // 침묵 감지 중지
    stopDetection();

    if (!mediaRecorderRef.current) {
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const shouldAutoSend = autoSendOnCompleteRef.current; // 자동 전송 플래그 캡처

    mediaRecorder.onstop = async () => {
      // 스트림 정리
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (audioChunksRef.current.length === 0) {
        setRecordingState('idle');
        autoSendOnCompleteRef.current = false;
        return;
      }

      // STT 변환 (Step3과 동일하게 직접 처리)
      setRecordingState('transcribing');

      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioData = new Uint8Array(arrayBuffer);

        // Step5 전용 STT 핸들러 호출
        const response = await window.electron.invoke('transcribe-step5-audio', {
          audioData,
          language: 'en',
        });

        if (response.success && response.data?.text) {
          const transcribedText = response.data.text;

          // 침묵 감지로 인한 자동 전송인 경우 바로 전송
          if (shouldAutoSend) {
            onSendMessage(transcribedText);
            setInputText('');
          } else {
            setInputText((prev) => (prev ? prev + ' ' + transcribedText : transcribedText));
          }
          setError(null);
        } else {
          console.error('STT failed:', response.error);
          setError(response.error || 'STT 변환에 실패했습니다.');
        }
      } catch (error) {
        console.error('STT 변환 오류:', error);
        setError('음성 인식 중 오류가 발생했습니다.');
      } finally {
        setRecordingState('idle');
        autoSendOnCompleteRef.current = false; // 플래그 리셋
      }
    };

    mediaRecorder.stop();
  }, [stopDetection, onSendMessage]);

  // stopRecording을 ref에 저장 (침묵 감지 콜백에서 참조)
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

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

  return (
    <div className={styles.input}>
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
          <button onClick={() => setError(null)} className={styles.errorClose}>
            ✕
          </button>
        </div>
      )}

      <div className={styles.controls}>
        {/* 자동 듣기 토글 */}
        <AutoListenToggle enabled={autoListenEnabled} onToggle={onToggleAutoListen} />

        {/* 녹음 버튼 */}
        <button
          className={`${styles.recordButton} ${recordingState === 'recording' ? styles.recording : ''}`}
          onClick={() => {
            if (recordingState === 'idle') {
              startRecording();
            } else {
              stopRecording();
            }
          }}
          disabled={isDisabled || recordingState === 'transcribing'}
          title={recordingState === 'idle' ? '음성 녹음' : '녹음 중지'}
        >
          {recordingState === 'idle' && '🎤'}
          {recordingState === 'recording' && (
            <>
              <span className={styles.recordingPulse}></span>
              🎤
            </>
          )}
          {recordingState === 'transcribing' && '⏳'}
        </button>

        {/* 텍스트 입력 */}
        <textarea
          className={styles.messageInput}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            recordingState === 'transcribing'
              ? '음성을 텍스트로 변환 중...'
              : '메시지를 입력하거나 음성으로 녹음하세요'
          }
          disabled={isDisabled || recordingState === 'recording'}
          rows={2}
        />

        {/* 자동 전송 토글 */}
        <AutoSendToggle
          enabled={autoSendEnabled}
          delay={autoSendDelay}
          onToggle={onToggleAutoSend}
          onChangeDelay={onChangeAutoSendDelay}
        />

        {/* 전송 버튼 */}
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!inputText.trim() || isDisabled || recordingState !== 'idle'}
          title="메시지 전송"
        >
          {isSending ? '전송 중...' : '보내기 ➤'}
        </button>
      </div>

      {recordingState === 'recording' && (
        <div className={styles.recordingIndicator}>
          <span className={styles.recordingDot}></span>
          녹음 중... (클릭하여 중지)
        </div>
      )}
    </div>
  );
};

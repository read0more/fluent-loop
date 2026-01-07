import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AutoSendToggle } from './AutoSendToggle';
import { useAutoSend } from '../../hooks/useAutoSend';

export interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isSending: boolean;
  autoSendEnabled: boolean;
  autoSendDelay: number;
  onToggleAutoSend: (enabled: boolean) => void;
  onChangeAutoSendDelay: (delay: number) => void;
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
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 자동 전송 훅
  const { startTimer, stopTimer } = useAutoSend(autoSendEnabled, autoSendDelay);

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

  // 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 스트림 정리
        stream.getTracks().forEach((track) => track.stop());

        // STT 변환
        await transcribeAudio();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setRecordingState('recording');
      setError(null);
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      setError('마이크 접근 권한이 필요합니다.');
      setRecordingState('idle');
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // STT 변환
  const transcribeAudio = async () => {
    setRecordingState('transcribing');

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = new Uint8Array(arrayBuffer);

      // 임시 파일로 저장 후 STT 변환
      const response = await window.electron.invoke('transcribe-audio', {
        audioData,
      });

      if (response.success && response.data?.text) {
        const transcribedText = response.data.text;
        setInputText((prev) => (prev ? prev + ' ' + transcribedText : transcribedText));
        setError(null);
      } else {
        setError(response.error || 'STT 변환에 실패했습니다.');
      }
    } catch (error) {
      console.error('STT 변환 오류:', error);
      setError('음성 인식 중 오류가 발생했습니다.');
    } finally {
      setRecordingState('idle');
    }
  };

  // 엔터키로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!autoSendEnabled) {
        handleSend();
      }
    }
  };

  const isDisabled = disabled || isSending || (recordingState !== 'idle' && recordingState !== 'transcribing');

  return (
    <div className="chat-input">
      {error && (
        <div className="input-error">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="error-close">
            ✕
          </button>
        </div>
      )}

      <div className="input-controls">
        {/* 녹음 버튼 */}
        <button
          className={`record-button ${recordingState === 'recording' ? 'recording' : ''}`}
          onClick={recordingState === 'idle' ? startRecording : stopRecording}
          disabled={isDisabled || recordingState === 'transcribing'}
          title={recordingState === 'idle' ? '음성 녹음' : '녹음 중지'}
        >
          {recordingState === 'idle' && '🎤'}
          {recordingState === 'recording' && (
            <>
              <span className="recording-pulse"></span>
              🎤
            </>
          )}
          {recordingState === 'transcribing' && '⏳'}
        </button>

        {/* 텍스트 입력 */}
        <textarea
          className="message-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            recordingState === 'transcribing'
              ? '음성을 텍스트로 변환 중...'
              : '메시지를 입력하거나 음성으로 녹음하세요'
          }
          disabled={isDisabled}
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
          className="send-button"
          onClick={handleSend}
          disabled={!inputText.trim() || isDisabled}
          title="메시지 전송"
        >
          {isSending ? '전송 중...' : '보내기 ➤'}
        </button>
      </div>

      {recordingState === 'recording' && (
        <div className="recording-indicator-inline">
          <span className="recording-dot"></span>
          녹음 중... (클릭하여 중지)
        </div>
      )}
    </div>
  );
};

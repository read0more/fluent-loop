import React, { useState, useEffect, useRef } from 'react';
import styles from './VoiceRecorder.module.scss';

export interface VoiceRecorderProps {
  maxDuration: number;
  onRecordingComplete: (filePath: string) => void;
  onRecordingError: (error: string) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  maxDuration,
  onRecordingComplete,
  onRecordingError,
  disabled = false,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 녹음 시작
  const startRecording = async () => {
    try {
      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const buffer = await audioBlob.arrayBuffer();

        setState('processing');

        try {
          // IPC를 통해 Main Process에 전송 (Uint8Array 사용 - 렌더러에서 Buffer 사용 불가)
          const response = await window.electron.invoke('stop-recording', new Uint8Array(buffer));

          if (response.success && response.data) {
            setState('complete');
            onRecordingComplete(response.data.filePath);
          } else {
            setState('idle');
            onRecordingError(response.error || '녹음 저장에 실패했습니다.');
          }
        } catch (error) {
          setState('idle');
          onRecordingError('녹음 처리 중 오류가 발생했습니다.');
        }

        // 스트림 정리
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setState('recording');
      setElapsedTime(0);

      // 타이머 시작 (IPC 호출 전에 시작해야 UI가 즉시 업데이트됨)
      const intervalId = setInterval(() => {
        setElapsedTime((prev) => {
          const newTime = prev + 1;
          // side effect 제거 - 순수 함수로 변경
          return newTime >= maxDuration ? maxDuration : newTime;
        });
      }, 1000);

      timerRef.current = intervalId;

      // IPC에 녹음 시작 알림
      await window.electron.invoke('start-recording');
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          onRecordingError('마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
        } else if (error.name === 'NotFoundError') {
          onRecordingError('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.');
        } else {
          onRecordingError('녹음 시작에 실패했습니다.');
        }
      }
      setState('idle');
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // 재설정
  const reset = () => {
    setState('idle');
    setElapsedTime(0);
  };

  // 컴포넌트 언마운트 시 정리 (빈 의존성 배열 - 언마운트 시에만 실행)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 최대 시간 도달 시 자동 중지
  useEffect(() => {
    if (elapsedTime >= maxDuration && state === 'recording') {
      stopRecording();
    }
  }, [elapsedTime, maxDuration, state]);

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.voiceRecorder}>
      <div className={styles.recorderDisplay}>
        <div className={styles.timer}>{formatTime(elapsedTime)}</div>
      </div>

      <div className={styles.recorderControls}>
        {state === 'idle' && (
          <>
            <button onClick={startRecording} disabled={disabled} className={styles.btnRecord}>
              새 토픽 녹음 시작
            </button>
            <div className={styles.durationHint}>최대 1분</div>
          </>
        )}

        {state === 'recording' && (
          <button onClick={stopRecording} className={styles.btnStop}>
            녹음 중지
          </button>
        )}

        {state === 'processing' && <div className={styles.processing}>처리 중...</div>}

        {state === 'complete' && (
          <button onClick={reset} className={styles.btnReset}>
            다시 녹음
          </button>
        )}
      </div>

      {state === 'recording' && (
        <div className={styles.recordingIndicator}>
          <span className={styles.pulse}></span>
          녹음 중
        </div>
      )}
    </div>
  );
};

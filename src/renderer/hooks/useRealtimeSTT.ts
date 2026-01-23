/**
 * useRealtimeSTT 훅
 *
 * 실시간 음성 인식 훅 (Step5 RolePlay 전용)
 * MediaRecorder를 사용하여 청크 단위로 음성을 수집하고 실시간으로 STT 변환
 *
 * 작성일: 2026-01-17
 * 관련 이슈: KAN-21
 * 테스트: src/renderer/hooks/__tests__/useRealtimeSTT.test.ts
 */

import { useState, useRef, useCallback } from 'react';

interface UseRealtimeSTTResult {
  text: string;
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetText: () => void;
}

interface STTStreamResponse {
  success: boolean;
  data?: {
    text: string;
    language: string;
    is_final: boolean;
  };
  error?: string;
}

/**
 * 실시간 STT 훅
 *
 * @param language 언어 코드 (기본값: 'ko')
 * @param chunkIntervalMs 청크 생성 간격 (밀리초, 기본값: 2500)
 * @returns UseRealtimeSTTResult
 */
export const useRealtimeSTT = (
  language: string = 'ko',
  chunkIntervalMs: number = 2500 // 2.5초마다 청크 전송
): UseRealtimeSTTResult => {
  const [text, setText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<string>(''); // 이전 청크의 텍스트 (컨텍스트)
  const accumulatedChunksRef = useRef<Blob[]>([]); // 청크 누적용 (완전한 WebM 생성)

  /**
   * 녹음 시작
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setText('');
      contextRef.current = '';
      accumulatedChunksRef.current = []; // 청크 배열 초기화

      // 마이크 권한 요청
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      // MediaRecorder 생성 (WebM 포맷)
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      // 청크 단위 데이터 수집
      mediaRecorder.ondataavailable = async (event: BlobEvent): Promise<void> => {
        if (event.data.size > 0) {
          setIsProcessing(true);

          try {
            // 새 청크를 누적 (완전한 WebM 파일 생성을 위해)
            accumulatedChunksRef.current.push(event.data);

            // 모든 청크를 합쳐서 완전한 WebM 생성
            // MediaRecorder의 첫 번째 청크에만 WebM 헤더가 포함되므로,
            // 후속 청크들도 유효한 파일로 만들기 위해 항상 전체를 합침
            const completeBlob = new Blob(accumulatedChunksRef.current, {
              type: 'audio/webm',
            });
            const arrayBuffer = await completeBlob.arrayBuffer();
            const audioChunk = new Uint8Array(arrayBuffer);

            // IPC 호출: 실시간 STT (완전한 WebM 전송)
            const response: STTStreamResponse = await window.electron.invoke(
              'transcribe-step5-audio-stream',
              {
                audioChunk,
                language,
                context: contextRef.current,
                isRecording: true, // 녹음 중 타임아웃 비활성화
              }
            );

            if (response.success && response.data?.text) {
              const newText = response.data.text.trim();

              // FR-002: 텍스트가 비어있지 않을 때만 업데이트 (Invalid WebM 시 기존 텍스트 유지)
              if (newText) {
                setText(newText);
                contextRef.current = newText; // 컨텍스트 업데이트
              }
              // 빈 텍스트가 들어오면 기존 텍스트 유지 (아무것도 하지 않음)
            } else if (response.success && !response.data?.text) {
              // FR-002: 빈 텍스트 응답 시 기존 텍스트 유지 (로깅만)
              console.log('[useRealtimeSTT] Empty text received, keeping previous text');
            } else if (response.error) {
              console.error('[useRealtimeSTT] STT error:', response.error);
              // 에러는 로깅만 하고 계속 진행 (graceful degradation)
            }
          } catch (err) {
            console.error('[useRealtimeSTT] Processing error:', err);
            // 에러 발생해도 녹음은 계속 진행
          } finally {
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.onerror = (event: Event): void => {
        console.error('[useRealtimeSTT] MediaRecorder error:', event);
        setError('녹음 중 오류가 발생했습니다.');
      };

      // 일정 간격(2.5초)마다 청크 생성
      mediaRecorder.start(chunkIntervalMs);
      setIsRecording(true);
    } catch (err: unknown) {
      console.error('[useRealtimeSTT] Start recording error:', err);
      const error = err as { name?: string; message?: string };

      // 에러 타입별 메시지 처리
      if (error.name === 'NotAllowedError') {
        setError('마이크 권한을 확인해주세요.');
      } else if (error.name === 'NotFoundError') {
        setError('마이크를 찾을 수 없습니다.');
      } else {
        setError('녹음 시작에 실패했습니다.');
      }
    }
  }, [language, chunkIntervalMs]);

  /**
   * 녹음 종료
   */
  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // MediaStream 트랙 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
      }

      // 청크 배열 정리
      accumulatedChunksRef.current = [];
    }
  }, [isRecording]);

  /**
   * 텍스트 초기화
   */
  const resetText = useCallback(() => {
    setText('');
    contextRef.current = '';
  }, []);

  return {
    text,
    isRecording,
    isProcessing,
    error,
    stream,
    startRecording,
    stopRecording,
    resetText,
  };
};

import { useRef, useCallback, useEffect } from 'react';

/**
 * 침묵 감지 훅
 * Web Audio API를 사용하여 실시간 음량 모니터링
 * 설정된 시간 동안 침묵이 지속되면 콜백 호출
 */

export interface UseSilenceDetectionOptions {
  /** 침묵 판단 임계값 (0-255, 기본값: 15) */
  threshold?: number;
  /** 침묵 지속 시간 (초) */
  silenceDelay: number;
  /** 활성화 여부 */
  enabled: boolean;
}

export interface UseSilenceDetectionReturn {
  /** 침묵 감지 시작 (MediaStream 전달) */
  startDetection: (stream: MediaStream) => void;
  /** 침묵 감지 중지 */
  stopDetection: () => void;
}

export const useSilenceDetection = (
  options: UseSilenceDetectionOptions,
  onSilenceDetected: () => void
): UseSilenceDetectionReturn => {
  const { threshold = 230, silenceDelay, enabled } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const soundDetectedRef = useRef(false);

  // 콜백을 ref로 저장하여 항상 최신 버전 사용 (클로저 캡처 문제 해결)
  const onSilenceDetectedRef = useRef(onSilenceDetected);

  // 최신 콜백 동기화
  useEffect(() => {
    onSilenceDetectedRef.current = onSilenceDetected;
  }, [onSilenceDetected]);

  // 리소스 정리
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    silenceStartRef.current = null;
    isActiveRef.current = false;
    soundDetectedRef.current = false;
  }, []);

  // 음량 레벨 체크
  const checkAudioLevel = useCallback(() => {
    if (!isActiveRef.current || !analyserRef.current || !enabled) {
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // 평균 음량 계산
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

    const now = Date.now();

    if (average < threshold) {
      // 침묵 상태 - 소리가 감지된 적이 있을 때만 타이머 시작
      if (soundDetectedRef.current) {
        if (silenceStartRef.current === null) {
          // 침묵 시작
          silenceStartRef.current = now;
          console.log('[SilenceDetection] Silence started after sound');
        } else {
          // 침묵 지속 시간 체크
          const silenceDuration = (now - silenceStartRef.current) / 1000;
          if (silenceDuration >= silenceDelay) {
            console.log(
              `[SilenceDetection] Silence detected for ${silenceDelay}s, triggering callback`
            );
            // 콜백 호출 전에 감지 중지
            isActiveRef.current = false;
            onSilenceDetectedRef.current();
            return;
          }
        }
      }
    } else {
      // 소리 감지
      soundDetectedRef.current = true;
      if (silenceStartRef.current !== null) {
        console.log('[SilenceDetection] Sound detected, resetting silence timer');
        silenceStartRef.current = null;
      }
    }

    // 다음 프레임에서 계속 체크
    animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
  }, [enabled, threshold, silenceDelay]); // onSilenceDetected는 ref로 관리하므로 의존성 제거

  // 침묵 감지 시작
  const startDetection = useCallback(
    (stream: MediaStream) => {
      if (!enabled) {
        console.log('[SilenceDetection] Not enabled, skipping');
        return;
      }

      // 기존 리소스 정리
      cleanup();

      try {
        // AudioContext 생성
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        // AnalyserNode 생성
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // MediaStream 연결
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        // 감지 활성화
        isActiveRef.current = true;
        silenceStartRef.current = null;
        soundDetectedRef.current = false;

        console.log('[SilenceDetection] Started with delay:', silenceDelay, 'seconds');

        // 음량 체크 시작
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      } catch (error) {
        console.error('[SilenceDetection] Failed to start:', error);
        cleanup();
      }
    },
    [enabled, silenceDelay, cleanup, checkAudioLevel]
  );

  // 침묵 감지 중지
  const stopDetection = useCallback(() => {
    console.log('[SilenceDetection] Stopped');
    cleanup();
  }, [cleanup]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { startDetection, stopDetection };
};

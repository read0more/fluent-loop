import React, { useEffect, useState, useCallback } from 'react';
import styles from './AppStartupLoader.module.scss';

interface BackendHealthStatus {
  status: string;
  whisper_loaded: boolean;
  tts_loaded: boolean;
  tts_status: 'pending' | 'downloading' | 'ready' | 'error';
  tts_message: string;
  tts_provider_type: string;
  tts_requires_download: boolean;
  tts_provider?: string;
  tts_voice?: string;
}

interface AppStartupLoaderProps {
  onReady: () => void;
}

type LoadingStage = 'connecting' | 'checking_tts' | 'downloading' | 'ready' | 'error';

export const AppStartupLoader: React.FC<AppStartupLoaderProps> = ({ onReady }) => {
  const [stage, setStage] = useState<LoadingStage>('connecting');
  const [message, setMessage] = useState('백엔드 서버 연결 중...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkBackendHealth = useCallback(async (): Promise<BackendHealthStatus | null> => {
    try {
      const result = await window.electron.invoke('get-backend-health');
      if (result.success && result.data) {
        return result.data as BackendHealthStatus;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const startHealthCheck = useCallback(async () => {
    const maxRetries = 30; // 최대 30번 시도 (60초)
    const retryInterval = 2000; // 2초 간격

    const attemptCheck = async () => {
      const health = await checkBackendHealth();

      if (!health) {
        // 백엔드 연결 실패
        if (retryCount < maxRetries) {
          setRetryCount((prev) => prev + 1);
          setMessage(`백엔드 서버 연결 중... (${retryCount + 1}/${maxRetries})`);
          setTimeout(attemptCheck, retryInterval);
        } else {
          setStage('error');
          setErrorMessage('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        }
        return;
      }

      // 백엔드 연결됨
      setStage('checking_tts');

      // edge-tts는 다운로드가 필요 없음
      if (!health.tts_requires_download) {
        if (health.tts_loaded) {
          setStage('ready');
          setMessage('준비 완료!');
          setTimeout(onReady, 500);
        } else if (health.tts_status === 'error') {
          // TTS 초기화 실패해도 앱은 사용 가능
          console.warn('TTS 초기화 실패:', health.tts_message);
          setStage('ready');
          setMessage('준비 완료 (TTS 사용 불가)');
          setTimeout(onReady, 500);
        } else {
          // 아직 초기화 중
          setMessage('TTS 서비스 초기화 중...');
          setTimeout(attemptCheck, retryInterval);
        }
        return;
      }

      // supertonic - 다운로드가 필요할 수 있음
      switch (health.tts_status) {
        case 'downloading':
          setStage('downloading');
          setMessage(health.tts_message || 'TTS 모델 다운로드 중...');
          setTimeout(attemptCheck, retryInterval);
          break;

        case 'ready':
          setStage('ready');
          setMessage('준비 완료!');
          setTimeout(onReady, 500);
          break;

        case 'error':
          // TTS 오류여도 앱은 사용 가능
          console.warn('TTS 초기화 실패:', health.tts_message);
          setStage('ready');
          setMessage('준비 완료 (TTS 사용 불가)');
          setTimeout(onReady, 500);
          break;

        case 'pending':
        default:
          setMessage('TTS 서비스 준비 중...');
          setTimeout(attemptCheck, retryInterval);
          break;
      }
    };

    attemptCheck();
  }, [checkBackendHealth, onReady, retryCount]);

  useEffect(() => {
    startHealthCheck();
  }, [startHealthCheck]);

  const handleRetry = () => {
    setStage('connecting');
    setMessage('백엔드 서버 연결 중...');
    setErrorMessage(null);
    setRetryCount(0);
    startHealthCheck();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.logoArea}>
          <h1 className={styles.title}>English Learning App</h1>
        </div>

        {stage === 'error' ? (
          <div className={styles.errorArea}>
            <div className={styles.errorIcon}>!</div>
            <p className={styles.errorMessage}>{errorMessage}</p>
            <button className={styles.retryButton} onClick={handleRetry}>
              다시 시도
            </button>
          </div>
        ) : (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p className={styles.message}>{message}</p>
            {stage === 'downloading' && (
              <p className={styles.subMessage}>
                최초 실행 시 모델 다운로드가 필요합니다. 잠시만 기다려주세요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

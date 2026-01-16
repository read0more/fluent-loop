import React, { useState, useEffect } from 'react';
import { VoiceSelector } from '../components/VoiceSelector';
import { AppSettings } from '../../main/database/models';
import styles from './SettingsPage.module.scss';

type SettingsPageState = 'loading' | 'loaded' | 'saving' | 'error';

export const SettingsPage: React.FC = () => {
  const [state, setState] = useState<SettingsPageState>('loading');
  const [settings, setSettings] = useState<AppSettings>({
    ttsVoiceId: 'en-US-AriaNeural',
    ttsVoiceIdUser: 'en-US-GuyNeural',
    recordingSavePath: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 설정 로드
  const loadSettings = async () => {
    setState('loading');
    setError(null);

    try {
      const response = await window.electron.invoke('get-all-settings');

      if (response.success && response.data) {
        setSettings(response.data);
        setState('loaded');
      } else {
        setState('error');
        setError(response.error || '설정을 불러올 수 없습니다.');
      }
    } catch (err) {
      setState('error');
      setError('설정 조회 중 오류가 발생했습니다.');
    }
  };

  // 설정 저장
  const saveSettings = async () => {
    setState('saving');
    setError(null);
    setSuccessMessage(null);

    try {
      // 화자A (AI 및 기본) TTS 음성 ID 저장
      const voiceResponse = await window.electron.invoke(
        'save-setting',
        'ttsVoiceId',
        settings.ttsVoiceId
      );

      if (!voiceResponse.success) {
        throw new Error(voiceResponse.error || 'AI 음성 설정 저장 실패');
      }

      // 화자B (User) TTS 음성 ID 저장
      const voiceUserResponse = await window.electron.invoke(
        'save-setting',
        'ttsVoiceIdUser',
        settings.ttsVoiceIdUser
      );

      if (!voiceUserResponse.success) {
        throw new Error(voiceUserResponse.error || 'User 음성 설정 저장 실패');
      }

      // 녹음 저장 경로 저장
      const pathResponse = await window.electron.invoke(
        'save-setting',
        'recordingSavePath',
        settings.recordingSavePath
      );

      if (!pathResponse.success) {
        throw new Error(pathResponse.error || '녹음 경로 설정 저장 실패');
      }

      setState('loaded');
      setSuccessMessage('설정이 저장되었습니다.');

      // 3초 후 성공 메시지 제거
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.');
    }
  };

  // 폴더 선택 대화상자
  const selectFolder = async () => {
    try {
      const response = await window.electron.invoke('select-folder');

      if (response.success && response.data && response.data.folderPath) {
        setSettings((prev) => ({
          ...prev,
          recordingSavePath: response.data.folderPath,
        }));
      } else if (response.error && !response.error.includes('취소')) {
        alert(response.error);
      }
    } catch (err) {
      alert('폴더 선택 중 오류가 발생했습니다.');
    }
  };

  // 설정 초기화
  const resetSettings = async () => {
    if (!confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
      return;
    }

    try {
      const response = await window.electron.invoke('reset-settings');

      if (response.success) {
        // 설정 다시 로드
        await loadSettings();
        setSuccessMessage('설정이 초기화되었습니다.');
      } else {
        alert(response.error || '설정 초기화에 실패했습니다.');
      }
    } catch (err) {
      alert('설정 초기화 중 오류가 발생했습니다.');
    }
  };

  // 컴포넌트 마운트 시 설정 로드
  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className={styles.page}>
      <h1>설정</h1>

      {/* 로딩 중 */}
      {state === 'loading' && <div className={styles.loading}>설정을 불러오는 중...</div>}

      {/* 에러 메시지 */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadSettings} className="btn-retry">
            재시도
          </button>
        </div>
      )}

      {/* 성공 메시지 */}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

      {/* 설정 폼 */}
      {(state === 'loaded' || state === 'saving') && (
        <div className={styles.form}>
          {/* TTS 음성 설정 */}
          <div className={styles.section}>
            <h2>TTS 음성</h2>
            <p className={styles.hint}>
              5, 6단계 대화에서 화자별로 다른 음성을 사용합니다.
            </p>
            <div className={styles.voiceGroup}>
              <VoiceSelector
                value={settings.ttsVoiceId}
                onChange={(voiceId) =>
                  setSettings((prev) => ({ ...prev, ttsVoiceId: voiceId }))
                }
                disabled={state === 'saving'}
                label="화자A (AI 및 기본 TTS)"
              />
            </div>
            <div className={styles.voiceGroup}>
              <VoiceSelector
                value={settings.ttsVoiceIdUser}
                onChange={(voiceId) =>
                  setSettings((prev) => ({ ...prev, ttsVoiceIdUser: voiceId }))
                }
                disabled={state === 'saving'}
                label="화자B (User)"
              />
            </div>
          </div>

          {/* 녹음 저장 경로 설정 */}
          <div className={styles.section}>
            <h2>녹음 파일 저장 위치</h2>
            <div className={styles.pathSelector}>
              <input
                type="text"
                value={settings.recordingSavePath || '기본 경로 사용'}
                readOnly
                className={styles.pathInput}
              />
              <button onClick={selectFolder} disabled={state === 'saving'} className={styles.btnSelectFolder}>
                폴더 선택
              </button>
            </div>
            <p className={styles.hint}>
              비워두면 기본 경로(test-data/data/recordings/step2)를 사용합니다.
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className={styles.actions}>
            <button
              onClick={saveSettings}
              disabled={state === 'saving'}
              className={styles.btnSave}
            >
              {state === 'saving' ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={resetSettings}
              disabled={state === 'saving'}
              className={styles.btnReset}
            >
              초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

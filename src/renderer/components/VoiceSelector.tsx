import React, { useState, useEffect } from 'react';
import { Voice } from '../../main/database/models';
import styles from './VoiceSelector.module.scss';

export interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용 가능한 음성 목록 로드
  const loadVoices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.electron.invoke('get-tts-voices');

      if (response.success && response.data) {
        setVoices(response.data);
      } else {
        setError(response.error || '음성 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('음성 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 음성 목록 로드
  useEffect(() => {
    loadVoices();
  }, []);

  return (
    <div className={styles.voiceSelector}>
      <label className={styles.voiceSelectorLabel}>TTS 음성 선택</label>

      {loading && <div className={styles.voiceSelectorLoading}>음성 목록 로드 중...</div>}

      {error && (
        <div className={styles.voiceSelectorError}>
          <p>{error}</p>
          <button onClick={loadVoices} className="btn-retry">
            재시도
          </button>
        </div>
      )}

      {!loading && !error && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={styles.voiceSelectorDropdown}
        >
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name} ({voice.language})
              {voice.gender && ` - ${voice.gender === 'male' ? '남성' : voice.gender === 'female' ? '여성' : '중성'}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

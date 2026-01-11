import React from 'react';
import styles from './AutoListenToggle.module.scss';

export interface AutoListenToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * 자동 듣기 모드 토글
 * 활성화하면 페이지 진입 시 자동 녹음 시작
 */
export const AutoListenToggle: React.FC<AutoListenToggleProps> = ({ enabled, onToggle }) => {
  return (
    <div className={`${styles.toggle} ${enabled ? styles.active : ''}`}>
      <label className={styles.switch}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className={styles.slider}></span>
      </label>
      <span className={styles.label}>항상 듣기</span>
    </div>
  );
};

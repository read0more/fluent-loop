import React from 'react';
import styles from './AutoListenToggle.module.scss';

export interface AutoListenToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * 내 차례 자동 녹음 토글
 * 활성화하면 사용자 대화 차례에 자동으로 녹음 시작
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
      <span className={styles.label}>내 차례 자동 녹음</span>
    </div>
  );
};

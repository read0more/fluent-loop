import React from 'react';
import styles from './AutoSendToggle.module.scss';

export interface AutoSendToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * 자동 전송 ON/OFF 토글
 */
export const AutoSendToggle: React.FC<AutoSendToggleProps> = ({
  enabled,
  onToggle,
}) => {
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
      <span className={styles.label}>자동전송</span>
    </div>
  );
};

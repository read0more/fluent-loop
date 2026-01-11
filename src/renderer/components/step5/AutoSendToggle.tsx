import React from 'react';
import styles from './AutoSendToggle.module.scss';

export interface AutoSendToggleProps {
  enabled: boolean;
  delay: number;
  onToggle: (enabled: boolean) => void;
  onChangeDelay: (delay: number) => void;
}

/**
 * 자동 전송 ON/OFF 토글 및 딜레이 설정
 */
export const AutoSendToggle: React.FC<AutoSendToggleProps> = ({
  enabled,
  delay,
  onToggle,
  onChangeDelay,
}) => {
  return (
    <div className={styles.toggle}>
      <label className={styles.switch}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className={styles.slider}></span>
        <span className={styles.label}>자동전송</span>
      </label>

      {enabled && (
        <div className={styles.delayControl}>
          <span className={styles.delayIcon}>⏱</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={delay}
            onChange={(e) => onChangeDelay(parseFloat(e.target.value))}
            className={styles.delaySlider}
          />
          <span className={styles.delayValue}>{delay}초</span>
        </div>
      )}
    </div>
  );
};

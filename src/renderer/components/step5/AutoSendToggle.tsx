import React from 'react';

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
    <div className="auto-send-toggle">
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="toggle-slider"></span>
        <span className="toggle-label">자동전송</span>
      </label>

      {enabled && (
        <div className="delay-control">
          <span className="delay-icon">⏱</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={delay}
            onChange={(e) => onChangeDelay(parseFloat(e.target.value))}
            className="delay-slider"
          />
          <span className="delay-value">{delay}초</span>
        </div>
      )}
    </div>
  );
};

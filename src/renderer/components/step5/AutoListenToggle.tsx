import React from 'react';

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
    <div className={`auto-listen-toggle ${enabled ? 'active' : ''}`}>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="toggle-slider"></span>
      </label>
      <span className="toggle-label">항상 듣기</span>
    </div>
  );
};

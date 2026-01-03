import React from 'react';

export interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '처리 중...',
  size = 'medium',
  fullScreen = false,
}) => {
  const spinnerClass = `spinner spinner-${size}`;

  const content = (
    <div className="loading-spinner">
      <div className={spinnerClass}></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-overlay">{content}</div>;
  }

  return content;
};

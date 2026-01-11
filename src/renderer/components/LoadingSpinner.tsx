import React from 'react';
import styles from './LoadingSpinner.module.scss';

export interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const sizeClassMap = {
  small: styles.spinnerSmall,
  medium: styles.spinnerMedium,
  large: styles.spinnerLarge,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '처리 중...',
  size = 'medium',
  fullScreen = false,
}) => {
  const spinnerClass = `${styles.spinner} ${sizeClassMap[size]}`;

  const content = (
    <div className={styles.loadingSpinner}>
      <div className={spinnerClass}></div>
      {message && <p className={styles.loadingMessage}>{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-overlay">{content}</div>;
  }

  return content;
};

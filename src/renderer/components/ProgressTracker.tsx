import React from 'react';
import { RetellingHistoryTooltip } from './RetellingHistoryTooltip';
import styles from './ProgressTracker.module.scss';

export interface ProgressTrackerProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
  labels?: string[];
  showCheckmarks?: boolean;
  topicId?: number;
  showHistory?: boolean;
}

export interface StepStatus {
  step: number;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

const CheckIcon: React.FC = () => (
  <svg
    className={styles.checkIcon}
    data-testid="check-icon"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="10" cy="10" r="9" fill="currentColor" />
    <path
      d="M6 10L9 13L14 7"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  currentStep,
  completedSteps,
  labels = ['1차: 3분', '2차: 2분', '3차: 1분'],
  showCheckmarks = true,
  topicId,
  showHistory = false,
}) => {
  const getStepStatus = (step: number): 'pending' | 'active' | 'completed' => {
    if (completedSteps.includes(step)) {
      return 'completed';
    }
    if (step === currentStep) {
      return 'active';
    }
    return 'pending';
  };

  const steps: StepStatus[] = [
    { step: 1, label: labels[0], status: getStepStatus(1) },
    { step: 2, label: labels[1], status: getStepStatus(2) },
    { step: 3, label: labels[2], status: getStepStatus(3) },
  ];

  return (
    <div className={styles.tracker}>
      {steps.map((stepInfo, index) => (
        <React.Fragment key={stepInfo.step}>
          <div className={`${styles.step} ${styles[stepInfo.status]}`} data-testid={`progress-step-${stepInfo.step}`}>
            <div className={styles.indicator}>
              {showCheckmarks && stepInfo.status === 'completed' ? (
                <CheckIcon />
              ) : (
                <span className={styles.stepNumber}>{stepInfo.step}</span>
              )}
            </div>
            <span className={styles.label}>
              {stepInfo.label}
              {showHistory && topicId && (
                <RetellingHistoryTooltip topicId={topicId} duration={stepInfo.step as 1 | 2 | 3} />
              )}
            </span>
          </div>

          {index < steps.length - 1 && <div className={styles.line} />}
        </React.Fragment>
      ))}
    </div>
  );
};

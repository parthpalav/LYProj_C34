import React from 'react';

interface ProgressBarProps {
  value: number; // 0 - 100
  max?: number;
  label?: string;
  weightText?: string;
  detail?: string;
  color?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  weightText,
  detail,
  color = 'var(--accent-primary)',
  className = '',
}) => {
  const percentage = Math.max(0, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className={`progress-bar-container ${className}`}>
      {(label || weightText) && (
        <div className="progress-bar-header">
          <span className="progress-bar-label">{label}</span>
          <div className="progress-bar-metrics">
            <span className="progress-bar-value">{percentage}</span>
            <span className="progress-bar-max">/100</span>
            {weightText && <span className="progress-bar-weight">({weightText})</span>}
          </div>
        </div>
      )}

      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Score progress'}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>

      {detail && <div className="progress-bar-detail">{detail}</div>}
    </div>
  );
};

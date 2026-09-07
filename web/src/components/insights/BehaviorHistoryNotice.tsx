import React from 'react';

export const BehaviorHistoryNotice: React.FC = () => {
  return (
    <div className="insights-notice-banner">
      <div className="notice-icon">ℹ️</div>
      <div className="notice-content">
        <span className="notice-title font-semibold text-sm">Historical Evaluation Boundary</span>
        <p className="notice-text text-xs text-secondary">
          Behavioral signals are evaluated dynamically against your active transaction window (up to the 50 most recent records). Longitudinal historical trend storage for behavioral signals is not currently persisted in the backend engine.
        </p>
      </div>
    </div>
  );
};

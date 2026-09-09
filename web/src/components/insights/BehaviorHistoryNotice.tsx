import React from 'react';
import { Info } from 'lucide-react';

export const BehaviorHistoryNotice: React.FC = () => {
  return (
    <div className="insights-notice-banner" role="note">
      <div className="notice-icon" aria-hidden="true">
        <Info size={16} className="text-secondary" />
      </div>
      <div className="notice-content">
        <span className="notice-title font-semibold text-sm text-primary">Historical Evaluation Boundary</span>
        <p className="notice-text text-xs text-secondary">
          Behavioral signals are evaluated dynamically against your active transaction window (up to the 50 most recent records). Longitudinal historical trend storage for behavioral signals is not currently persisted in the backend engine.
        </p>
      </div>
    </div>
  );
};

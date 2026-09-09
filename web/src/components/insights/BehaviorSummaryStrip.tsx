import React from 'react';
import type { DynamicSignalCounter } from '../../hooks/useBehaviorInsights';

export interface BehaviorSummaryStripProps {
  signals: DynamicSignalCounter[];
  anomaliesCount: number;
  analyzedCount: number;
}

export const BehaviorSummaryStrip: React.FC<BehaviorSummaryStripProps> = ({
  signals,
  anomaliesCount,
  analyzedCount,
}) => {
  return (
    <div className="activity-summary-strip" role="region" aria-label="Behavioral Diagnostics Summary">
      <div className="summary-item">
        <span className="summary-label">Analyzed Records</span>
        <span className="summary-value text-primary tabular-nums">
          {analyzedCount}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Detected Risk Patterns</span>
        <span className="summary-value text-primary tabular-nums">
          {signals.length}
        </span>
      </div>

      <div className="summary-divider" aria-hidden="true" />

      <div className="summary-item">
        <span className="summary-label">Spending Anomalies</span>
        <span className="summary-value text-primary tabular-nums">
          {anomaliesCount}
        </span>
      </div>

      {signals.map((sig) => (
        <React.Fragment key={sig.type}>
          <div className="summary-divider" aria-hidden="true" />
          <div className="summary-item">
            <span className="summary-label">{sig.label}</span>
            <span className="summary-value text-primary tabular-nums">
              {sig.count}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

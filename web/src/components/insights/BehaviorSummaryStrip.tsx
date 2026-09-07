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
    <div className="activity-summary-strip">
      <div className="summary-metric-card">
        <span className="summary-metric-label">Analyzed Transactions</span>
        <span className="summary-metric-value text-primary font-bold">
          {analyzedCount}
        </span>
        <span className="summary-metric-subtext text-xs text-tertiary">
          Evaluation analysis window
        </span>
      </div>

      <div className="summary-metric-card">
        <span className="summary-metric-label">Detected Risk Patterns</span>
        <span
          className={`summary-metric-value font-bold ${
            signals.length > 0 ? 'text-amber' : 'text-emerald'
          }`}
        >
          {signals.length}
        </span>
        <span className="summary-metric-subtext text-xs text-tertiary">
          {signals.length === 0 ? 'Optimal discipline' : 'Patterns requiring attention'}
        </span>
      </div>

      <div className="summary-metric-card">
        <span className="summary-metric-label">Spending Anomalies</span>
        <span
          className={`summary-metric-value font-bold ${
            anomaliesCount > 0 ? 'text-danger' : 'text-primary'
          }`}
        >
          {anomaliesCount}
        </span>
        <span className="summary-metric-subtext text-xs text-tertiary">
          {anomaliesCount === 0 ? 'No statistical outliers' : 'Transactions > 1.8× average'}
        </span>
      </div>

      {/* Render any additional dynamically verified pattern types */}
      {signals.map((sig) => (
        <div key={sig.type} className="summary-metric-card">
          <span className="summary-metric-label">{sig.label}</span>
          <span className="summary-metric-value font-bold text-amber">
            {sig.emoji} {sig.count}
          </span>
          <span className="summary-metric-subtext text-xs text-tertiary">
            Severity: {sig.severity}
          </span>
        </div>
      ))}
    </div>
  );
};

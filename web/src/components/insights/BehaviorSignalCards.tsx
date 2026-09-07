import React from 'react';
import type { BehaviorPattern } from '../../types';

export interface BehaviorSignalCardsProps {
  patterns: BehaviorPattern[];
}

export const BehaviorSignalCards: React.FC<BehaviorSignalCardsProps> = ({ patterns }) => {
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high':
        return <span className="badge-severity badge-sev-high">High Impact</span>;
      case 'medium':
        return <span className="badge-severity badge-sev-med">Medium Alert</span>;
      default:
        return <span className="badge-severity badge-sev-low">Nudge</span>;
    }
  };

  const formatPatternTitle = (type: string) => {
    switch (type) {
      case 'late_night':
        return 'Late-Night Spending Pattern';
      case 'food_spike':
        return 'Elevated Food Expenditure';
      case 'impulse_shopping':
        return 'Frequent Shopping Cluster';
      case 'anomaly_cluster':
        return 'Unusual Spending Spike Cluster';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  if (patterns.length === 0) {
    return (
      <div className="insights-card">
        <div className="empty-behavior-box">
          <span className="empty-behavior-emoji">✨</span>
          <h3 className="card-title">No Behavioral Risk Patterns Detected</h3>
          <p className="text-secondary text-sm" style={{ marginTop: '8px' }}>
            Your recent spending shows disciplined consistency with no late-night spikes, excessive impulse shopping, or cluster anomalies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Detected Behavioral Patterns</h3>
          <p className="card-subtitle">
            Algorithmic signals flagged from your recent transactions
          </p>
        </div>
      </div>

      <div className="behavior-patterns-grid">
        {patterns.map((p, idx) => (
          <div key={idx} className="behavior-pattern-card">
            <div className="pattern-card-top">
              <span className="pattern-emoji">{p.emoji || '⚡'}</span>
              <div className="pattern-title-wrap">
                <span className="pattern-title font-semibold">{formatPatternTitle(p.type)}</span>
                <span className="pattern-type-code text-xs text-tertiary">{p.type}</span>
              </div>
              {getSeverityBadge(p.severity)}
            </div>
            <p className="pattern-message text-sm text-secondary">{p.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

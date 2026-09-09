import React from 'react';
import { Moon, Utensils, ShoppingBag, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import type { BehaviorPattern } from '../../types';

export interface BehaviorSignalCardsProps {
  patterns: BehaviorPattern[];
}

export const BehaviorSignalCards: React.FC<BehaviorSignalCardsProps> = ({ patterns }) => {
  const getSeverityBadge = (sev: string) => {
    const s = sev?.toLowerCase();
    const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Medium';
    if (s === 'high') {
      return <span className="badge-severity badge-sev-high">{label}</span>;
    }
    if (s === 'medium') {
      return <span className="badge-severity badge-sev-med">{label}</span>;
    }
    return <span className="badge-severity badge-sev-low">{label}</span>;
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'late_night':
        return <Moon size={18} className="text-secondary" aria-hidden="true" />;
      case 'food_spike':
        return <Utensils size={18} className="text-secondary" aria-hidden="true" />;
      case 'impulse_shopping':
        return <ShoppingBag size={18} className="text-secondary" aria-hidden="true" />;
      case 'anomaly_cluster':
        return <AlertTriangle size={18} className="text-warning" aria-hidden="true" />;
      default:
        return <Activity size={18} className="text-secondary" aria-hidden="true" />;
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
          <CheckCircle2 size={32} className="text-emerald mb-2" aria-hidden="true" />
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
          <span className="overview-context-badge">ALGORITHMIC DETECTION</span>
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
              <div className="pattern-icon-avatar">
                {getPatternIcon(p.type)}
              </div>
              <div className="pattern-title-wrap">
                <span className="pattern-title font-semibold text-primary">{formatPatternTitle(p.type)}</span>
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

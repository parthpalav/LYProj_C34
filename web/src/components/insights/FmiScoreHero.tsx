import React from 'react';
import type { FMIResponse } from '../../types';

export interface FmiScoreHeroProps {
  fmi: FMIResponse | null;
}

export const FmiScoreHero: React.FC<FmiScoreHeroProps> = ({ fmi }) => {
  if (!fmi) return null;

  const score = fmi.score ?? fmi.FMI ?? 0;
  const label = fmi.fmiLabel || 'Active';

  const getScoreColorClass = (s: number) => {
    if (s >= 80) return 'text-emerald';
    if (s >= 65) return 'text-blue';
    if (s >= 45) return 'text-amber';
    return 'text-danger';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_track':
        return <span className="badge-fmi-status status-on-track">✓ On Track</span>;
      case 'below':
        return <span className="badge-fmi-status status-below">⚡ Surplus Saving</span>;
      case 'above':
        return <span className="badge-fmi-status status-above">⚠️ Spending Pace Above Budget</span>;
      default:
        return <span className="badge-fmi-status">{status}</span>;
    }
  };

  return (
    <div className="insights-hero-card fmi-hero-card">
      <div className="hero-content-row">
        <div className="hero-score-cluster">
          <div className="score-ring-wrap">
            <span className={`hero-score-value font-black ${getScoreColorClass(score)}`}>
              {score}
            </span>
            <span className="hero-score-denom text-tertiary">/100</span>
          </div>
          <div className="hero-meta">
            <div className="hero-label-row">
              <span className="hero-title">Financial Momentum Index (FMI)</span>
              <span className="hero-fmi-label">{label}</span>
            </div>
            <p className="hero-subtitle text-secondary text-sm">
              Deterministic composite financial health measurement evaluated across saving, spending control, and behavioral risk discipline.
            </p>
          </div>
        </div>
        <div className="hero-status-box">
          {getStatusBadge(fmi.status)}
        </div>
      </div>
    </div>
  );
};
